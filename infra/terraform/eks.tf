module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.24"

  cluster_name    = "${var.project}-${var.environment}"
  cluster_version = var.eks_cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true # restrict to office/VPN CIDR in real prod via cluster_endpoint_public_access_cidrs

  enable_cluster_creator_admin_permissions = true

  eks_managed_node_groups = {
    default = {
      instance_types = var.eks_node_instance_types
      min_size       = var.eks_node_min_size
      max_size       = var.eks_node_max_size
      desired_size   = var.eks_node_desired_size
      capacity_type  = "ON_DEMAND"
    }
  }

  cluster_addons = {
    coredns                = { most_recent = true }
    kube-proxy              = { most_recent = true }
    vpc-cni                 = { most_recent = true }
    aws-ebs-csi-driver      = { most_recent = true }
  }
}

# ECR repositories - one per deployable image
resource "aws_ecr_repository" "images" {
  for_each             = toset(["athe-backend", "athe-storefront", "athe-admin", "athe-staff"])
  name                 = each.key
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "expire_untagged" {
  for_each   = aws_ecr_repository.images
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Expire untagged images after 14 days"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = 14
      }
      action = { type = "expire" }
    }]
  })
}
