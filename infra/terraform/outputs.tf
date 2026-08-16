output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "ecr_repository_urls" {
  value = { for k, r in aws_ecr_repository.images : k => r.repository_url }
}

output "rds_endpoint" {
  value     = aws_db_instance.athe.endpoint
  sensitive = true
}

output "uploads_bucket_name" {
  value = aws_s3_bucket.uploads.bucket
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}

output "backend_irsa_role_arn" {
  value = module.backend_irsa.iam_role_arn
}
