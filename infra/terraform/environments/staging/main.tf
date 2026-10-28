terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "interest-terraform-state-staging"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "interest-terraform-locks-staging"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Interest"
      Environment = "staging"
      ManagedBy   = "Terraform"
    }
  }
}

# 1. VPC Module
module "vpc" {
  source             = "../../modules/vpc"
  project_name       = "interest"
  environment        = "staging"
  vpc_cidr           = "10.10.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  single_nat_gateway = true # Cost optimized for staging
}

# 2. S3 Storage Module
module "s3" {
  source               = "../../modules/s3"
  project_name         = "interest"
  environment          = "staging"
  allowed_cors_origins = ["https://staging.interest.internal", "http://localhost:3000"]
}

# 3. CloudFront CDN Module
module "cloudfront" {
  source                          = "../../modules/cloudfront"
  project_name                    = "interest"
  environment                     = "staging"
  hls_bucket_id                   = module.s3.hls_video_bucket_id
  hls_bucket_arn                  = module.s3.hls_video_bucket_arn
  hls_bucket_regional_domain_name = module.s3.hls_video_bucket_domain_name
}

# 4. RDS PostgreSQL 16 Module (with pgvector)
module "rds" {
  source                 = "../../modules/rds"
  project_name           = "interest"
  environment            = "staging"
  vpc_id                 = module.vpc.vpc_id
  subnet_ids             = module.vpc.private_db_subnet_ids
  app_security_group_ids = [module.ecs.ecs_tasks_security_group_id]

  instance_class         = "db.t4g.medium"
  allocated_storage      = 50
  max_allocated_storage  = 200
  db_name                = "interest_staging"
  db_username            = "interest_admin"
  db_password            = var.db_password
  multi_az               = false # Single AZ for staging cost savings
  backup_retention_days  = 7
}

# 5. ElastiCache Redis 7 Module
module "elasticache" {
  source                     = "../../modules/elasticache"
  project_name               = "interest"
  environment                = "staging"
  vpc_id                     = module.vpc.vpc_id
  subnet_ids                 = module.vpc.private_db_subnet_ids
  app_security_group_ids     = [module.ecs.ecs_tasks_security_group_id]

  node_type                  = "cache.t4g.medium"
  num_cache_clusters         = 1
  automatic_failover_enabled = false
  multi_az_enabled           = false
  auth_token                 = var.redis_auth_token
  snapshot_retention_limit   = 3
}

# 6. ECS Fargate Cluster & ALB Module
module "ecs" {
  source               = "../../modules/ecs"
  project_name         = "interest"
  environment          = "staging"
  aws_region           = var.aws_region
  vpc_id               = module.vpc.vpc_id
  public_subnet_ids    = module.vpc.public_subnet_ids
  private_subnet_ids   = module.vpc.private_app_subnet_ids

  api_image            = var.api_image
  worker_image         = var.worker_image
  admin_image          = var.admin_image

  api_cpu              = 512
  api_memory           = 1024
  worker_cpu           = 1024
  worker_memory        = 2048
  admin_cpu            = 256
  admin_memory         = 512

  api_desired_count    = 1
  worker_desired_count = 1
  admin_desired_count  = 1
  api_max_count        = 4

  db_host              = module.rds.db_instance_address
  redis_host           = module.elasticache.redis_primary_endpoint
  s3_bucket_raw        = module.s3.raw_uploads_bucket_id
  s3_bucket_hls        = module.s3.hls_video_bucket_id
  cdn_domain           = module.cloudfront.cloudfront_distribution_domain_name
}
