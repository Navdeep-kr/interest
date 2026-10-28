output "raw_uploads_bucket_id" {
  value = aws_s3_bucket.raw_uploads.id
}

output "raw_uploads_bucket_arn" {
  value = aws_s3_bucket.raw_uploads.arn
}

output "hls_video_bucket_id" {
  value = aws_s3_bucket.hls_video.id
}

output "hls_video_bucket_arn" {
  value = aws_s3_bucket.hls_video.arn
}

output "hls_video_bucket_domain_name" {
  value = aws_s3_bucket.hls_video.bucket_regional_domain_name
}

output "assets_bucket_id" {
  value = aws_s3_bucket.assets.id
}

output "assets_bucket_arn" {
  value = aws_s3_bucket.assets.arn
}

output "backups_bucket_id" {
  value = aws_s3_bucket.backups.id
}

output "backups_bucket_arn" {
  value = aws_s3_bucket.backups.arn
}

output "s3_kms_key_arn" {
  value = aws_kms_key.s3_kms.arn
}
