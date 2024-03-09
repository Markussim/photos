provider "aws" {
  region = "eu-north-1"
}

resource "aws_iam_policy" "s3_access" {
  name        = "S3AccessPolicy"
  description = "Policy for allowing EC2 instance to access markus-photos"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject",
        ]
        Effect   = "Allow"
        Resource = "arn:aws:s3:::markus-photos/*"
      },
      {
        Action = [
          "s3:ListBucket",
        ]
        Effect   = "Allow"
        Resource = "arn:aws:s3:::markus-photos"
      }
    ]
  })
}

resource "aws_iam_role" "ec2_role" {
  name = "EC2Role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_access" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.s3_access.arn
}

resource "aws_iam_instance_profile" "ec2_s3_profile" {
  name = "EC2S3InstanceProfile"
  role = aws_iam_role.ec2_role.name
}

resource "aws_security_group" "http" {
  name        = "http"
  description = "Allow HTTP inbound traffic"
  vpc_id      = "vpc-26972a4f"

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
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

resource "aws_security_group" "ssh" {
  name        = "ssh"
  description = "Allow SSH inbound traffic"
  vpc_id      = "vpc-26972a4f"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
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

variable "PORT" {
  default = 80
}

resource "aws_instance" "photos-instance" {
  count         = 1
  ami           = "ami-070af08af12a8dce6"
  instance_type = "t4g.micro"

  iam_instance_profile = aws_iam_instance_profile.ec2_s3_profile.name

  vpc_security_group_ids = [aws_security_group.http.id, aws_security_group.ssh.id]

  // User data to install the application from github
  user_data = <<-EOF
                #!/bin/bash
                sudo yum update -y
                sudo yum install -y git nodejs npm
                git clone https://github.com/Markussim/photos.git
                cd photos/server
                npm install
                export PORT=${var.PORT}
                npm start
                EOF



  tags = {
    Name = "photos-instance"
  }
}
