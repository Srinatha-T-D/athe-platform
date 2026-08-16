terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  # Remote state - create this S3 bucket + DynamoDB lock table once, by hand
  # or in a bootstrap stack, before running this.
  backend "s3" {
    bucket         = "athe-terraform-state"
    key            = "athe/prod/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "athe-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "athe"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
