terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "interest-terraform-state-production"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "interest-terraform-locks-production"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Interest"
      Environment = "production"
      ManagedBy   = "Terraform"
    }
  }
}

# 1. VPC Module (Multi-AZ with 3 NAT Gateways)
module "vpc" {
  source             = "../../modules/vpc"
  project_name       = "interest"
  environment        = "production"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  single_nat_gateway = false # High Availability: 1 NAT Gateway per AZ
}

# 2. S3 Storage Module
module "s3" {
  source               = "../../modules/s3"
  project_name         = "interest"
  environment          = "production"
  allowed_cors_origins = ["https://interest.app", "https://admin.interest.app"]
}

# 3. CloudFront CDN Module (with Edge Zero-Location Sanitizer)
module "cloudfront" {
  source                          = "../../modules/cloudfront"
  project_name                    = "interest"
  environment                     = "production"
  hls_bucket_id                   = module.s3.hls_video_bucket_id
  hls_bucket_arn                  = module.s3.hls_video_bucket_arn
  hls_bucket_regional_domain_name = module.s3.hls_video_bucket_domain_name
}

# 4. RDS PostgreSQL 16 Module (Multi-AZ with pgvector)
module "rds" {
  source                 = "../../modules/rds"
  project_name           = "interest"
  environment            = "production"
  vpc_id                 = module.vpc.vpc_id
  subnet_ids             = module.vpc.private_db_subnet_ids
  app_security_group_ids = [module.ecs.ecs_tasks_security_group_id]

  instance_class         = "db.r6g.xlarge"
  allocated_storage      = 100
  max_allocated_storage  = 2000
  db_name                = "interest_prod"
  db_username            = "interest_master"
  db_password            = var.db_password
  multi_az               = true # High Availability across Availability Zones
  backup_retention_days  = 35   # Full 35-day Point-in-Time Recovery (PITR)
  max_connections        = "500"
}

# 5. ElastiCache Redis 7 Module (Multi-AZ Cluster)
module "elasticache" {
  source                     = "../../modules/elasticache"
  project_name               = "interest"
  environment                = "production"
  vpc_id                     = module.vpc.vpc_id
  subnet_ids                 = module.vpc.private_db_subnet_ids
  app_security_group_ids     = [module.ecs.ecs_tasks_security_group_id]

  node_type                  = "cache.m6g.large"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true
  auth_token                 = var.redis_auth_token
  snapshot_retention_limit   = 7
}

# 6. ECS Fargate Cluster & ALB Module
module "ecs" {
  source               = "../../modules/ecs"
  project_name         = "interest"
  environment          = "production"
  aws_region           = var.aws_region
  vpc_id               = module.vpc.vpc_id
  public_subnet_ids    = module.vpc.public_subnet_ids
  private_subnet_ids   = module.vpc.private_app_subnet_ids
  acm_certificate_arn  = var.acm_certificate_arn

  api_image            = var.api_image
  worker_image         = var.worker_image
  admin_image          = var.admin_image

  api_cpu              = 1024
  api_memory           = 2048
  worker_cpu           = 2048
  worker_memory        = 4096
  admin_cpu            = 512
  admin_memory         = 1024

  api_desired_count    = 4
  api_max_count        = 20
  worker_desired_count = 3
  admin_desired_count  = 2
  log_retention_days   = 60

  db_host              = module.rds.db_instance_address
  redis_host           = module.elasticache.redis_primary_endpoint
  s3_bucket_raw        = module.s3.raw_uploads_bucket_id
  s3_bucket_hls        = module.s3.hls_video_bucket_id
  cdn_domain           = module.cloudfront.cloudfront_distribution_domain_name
}
