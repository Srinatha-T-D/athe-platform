resource "aws_s3_bucket" "uploads" {
  bucket = "${var.project}-design-uploads-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  # ACL-based public grants stay blocked (best practice); policy-based access
  # is opened just enough below for the designs/ prefix, since the backend
  # hands out plain https://bucket.s3.region.amazonaws.com/designs/... URLs
  # (frontend/storefront + frontend/admin img tags load them directly, with
  # no CloudFront/OAC in front) - without this, every uploaded design and
  # inventory garment photo 403s in the browser and never renders.
  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

# Design/garment images are meant to be publicly visible on the storefront
# (they're not sensitive) - mirrors infra/free-tier/main.tf's uploads bucket.
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

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_methods = ["PUT", "GET"]
    allowed_origins = ["https://shop.athe.example.com"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    id     = "expire-rejected-uploads"
    status = "Enabled"
    filter { prefix = "designs/uploads/" }
    expiration { days = 90 }
  }
}

# CloudTrail + access logs bucket (security/audit trail requirement)
resource "aws_s3_bucket" "logs" {
  bucket = "${var.project}-audit-logs-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
