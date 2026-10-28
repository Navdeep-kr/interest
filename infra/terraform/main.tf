terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Interest"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# 1. VPC & Networking
# -----------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "interest-vpc-${var.environment}"
  }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true
  tags                    = { Name = "interest-public-a" }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true
  tags                    = { Name = "interest-public-b" }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "${var.aws_region}a"
  tags              = { Name = "interest-private-a" }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.20.0/24"
  availability_zone = "${var.aws_region}b"
  tags              = { Name = "interest-private-b" }
}

# -----------------------------------------------------------------------------
# 2. S3 Video Storage & CloudFront CDN
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "reels_hls" {
  bucket        = "interest-reels-hls-${var.environment}"
  force_destroy = false
}

resource "aws_s3_bucket_cors_configuration" "reels_cors" {
  bucket = aws_s3_bucket.reels_hls.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "interest-hls-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "hls_cdn" {
  origin {
    domain_name              = aws_s3_bucket.reels_hls.bucket_regional_domain_name
    origin_id                = "S3-HLS-Origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Global CDN for Interest HLS video segments"
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-HLS-Origin"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 1 day for playlists
    max_ttl                = 31536000 # 1 year for immutable .ts chunks
    compress               = true
  }

  price_class = "PriceClass_All"

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none" # Core invariant: Zero geographic restrictions
    }
  }
}

# -----------------------------------------------------------------------------
# 3. RDS PostgreSQL 16 with pgvector Extension
# -----------------------------------------------------------------------------
resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "interest-rds-subnets"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_db_parameter_group" "pgvector_pg" {
  name   = "interest-postgres16-pgvector"
  family = "postgres16"

  parameter {
    name  = "shared_preload_libraries"
    value = "vector"
  }

  parameter {
    name  = "max_connections"
    value = "300"
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "interest-postgres-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16.1"
  instance_class         = var.db_instance_class
  allocated_storage      = 100
  max_allocated_storage  = 1000
  storage_type           = "gp3"
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  parameter_group_name   = aws_db_parameter_group.pgvector_pg.name
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  skip_final_snapshot    = true
  publicly_accessible    = false
}

# -----------------------------------------------------------------------------
# 4. Redis 7 Replication Group (BullMQ & Bloom Filter)
# -----------------------------------------------------------------------------
resource "aws_elasticache_subnet_group" "redis_subnets" {
  name       = "interest-redis-subnets"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "interest-redis-${var.environment}"
  description                = "Redis cluster for BullMQ queues and Bloom deduplication"
  node_type                  = "cache.m6g.large"
  num_cache_clusters         = 2
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis_subnets.name
  automatic_failover_enabled = true
}

# -----------------------------------------------------------------------------
# 5. ECS Fargate Cluster (Core API & Workers)
# -----------------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "interest-cluster-${var.environment}"
}
