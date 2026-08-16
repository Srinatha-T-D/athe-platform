terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.50" }
  }
  # Simple local state is fine for a single-instance free-tier stack.
  # Switch to an S3 backend later if you outgrow this.
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "ap-south-1"
}

variable "project" {
  default = "athe"
}

variable "key_pair_name" {
  description = "Name of an EC2 key pair you already created in the AWS Console (EC2 > Key Pairs), for SSH access."
  type        = string
}

variable "ssh_cidr" {
  description = "Your IP in CIDR form, e.g. 49.207.10.5/32. Get it from https://checkip.amazonaws.com"
  type        = string
}

variable "api_base_url" {
  description = "Public URL the storefront/admin/staff frontends should call for the API (baked into the frontend build at deploy time - see docker-compose.prod.yml). Must match the api.* host in infra/free-tier/Caddyfile, e.g. https://api.athe.space. Leave as the default only if you haven't pointed a domain at the Elastic IP yet."
  default     = "https://api.athe.space"
  type        = string
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ---------- S3 bucket for design uploads (free tier: 5GB) ----------
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.project}-uploads-${data.aws_caller_identity.current.account_id}"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

# Design images are meant to be publicly visible on the storefront (they're
# not sensitive), so allow public read-only access to just this prefix.
resource "aws_s3_bucket_policy" "uploads_public_read" {
  bucket = aws_s3_bucket.uploads.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadDesigns"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.uploads.arn}/designs/*"
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.uploads]
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_methods = ["PUT", "GET"]
    allowed_origins = ["*"] # tighten to your real domain once you have one
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

# ---------- IAM role for the EC2 instance (S3 access only, no static keys needed) ----------
resource "aws_iam_role" "ec2" {
  name = "${var.project}-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "ec2_s3" {
  name = "${var.project}-ec2-s3-access"
  role = aws_iam_role.ec2.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
      Resource = [aws_s3_bucket.uploads.arn, "${aws_s3_bucket.uploads.arn}/*"]
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ---------- Security group: 22 (your IP only), 80/443 (public) ----------
resource "aws_security_group" "athe" {
  name_prefix = "${var.project}-"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH from your IP only"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------- Free-tier EC2 instance ----------
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "athe" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = "t3.micro" # free tier: 750 hrs/month for 12 months
  key_name               = var.key_pair_name
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.athe.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  root_block_device {
    volume_size = 30 # free tier: up to 30GB EBS gp2/gp3
    volume_type = "gp3"
  }

  user_data = templatefile("${path.module}/user-data.sh.tpl", {
    uploads_bucket = aws_s3_bucket.uploads.bucket
    aws_region     = var.aws_region
    api_base_url   = var.api_base_url
  })

  tags = { Name = "${var.project}-app-server" }
}

# Free tier includes 1 Elastic IP as long as it's attached to a running instance
resource "aws_eip" "athe" {
  instance = aws_instance.athe.id
  domain   = "vpc"
}

output "public_ip" {
  value = aws_eip.athe.public_ip
}

output "ssh_command" {
  value = "ssh -i <your-key>.pem ec2-user@${aws_eip.athe.public_ip}"
}

output "uploads_bucket" {
  value = aws_s3_bucket.uploads.bucket
}

output "urls" {
  value = {
    storefront = "http://${aws_eip.athe.public_ip}"
    admin      = "http://${aws_eip.athe.public_ip}:8081"
    staff      = "http://${aws_eip.athe.public_ip}:8082"
    api        = "http://${aws_eip.athe.public_ip}:4000"
    grafana    = "http://${aws_eip.athe.public_ip}:3000"
    prometheus = "http://${aws_eip.athe.public_ip}:9090"
  }
}
