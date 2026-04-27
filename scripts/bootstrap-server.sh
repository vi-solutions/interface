#!/usr/bin/env bash
# Run once from your local machine to set up the deploy user on the server.
# Usage: ./scripts/bootstrap-server.sh
set -euo pipefail

SSH_HOST="inter"
DEPLOY_PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFYiiU3yLT3yIkle8E3eXBKLiPBl2FVOC+VCh1YEujfw deploy@vi-solutions/interface"
REPO="git@interface.github.com:vi-solutions/interface.git"
REMOTE_DIR="/home/deploy/interface"

echo "==> Bootstrapping server via $SSH_HOST (running as root)..."

ssh "$SSH_HOST" bash << ENDSSH
  set -euo pipefail

  echo "--- Creating deploy user..."
  id deploy &>/dev/null || useradd -m -s /bin/bash deploy

  echo "--- Setting up SSH access for deploy user..."
  mkdir -p /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  echo "$DEPLOY_PUBKEY" > /home/deploy/.ssh/authorized_keys
  chmod 600 /home/deploy/.ssh/authorized_keys
  chown -R deploy:deploy /home/deploy/.ssh

  echo "--- Adding deploy to docker group..."
  usermod -aG docker deploy

  echo "--- Installing Docker (if needed)..."
  if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    usermod -aG docker deploy
  fi

  echo "--- Installing certbot (if needed)..."
  if ! command -v certbot &>/dev/null; then
    apt-get install -y certbot
  fi

  echo "--- Verifying GitHub deploy key..."
  if [ ! -f /home/deploy/.ssh/interface_deploy_key ]; then
    echo "ERROR: /home/deploy/.ssh/interface_deploy_key not found."
    echo "Place the private key there, then re-run this script."
    exit 1
  fi
  chmod 600 /home/deploy/.ssh/interface_deploy_key
  chown deploy:deploy /home/deploy/.ssh/interface_deploy_key

  # SSH config so git uses the deploy key for the interface repo
  cat > /home/deploy/.ssh/config << 'SSHCONF'
Host interface.github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/interface_deploy_key
  IdentitiesOnly yes
SSHCONF
  chmod 600 /home/deploy/.ssh/config
  chown deploy:deploy /home/deploy/.ssh/config

  echo "--- Cloning repo (if not already cloned)..."
  if [ ! -d "$REMOTE_DIR/.git" ]; then
    sudo -u deploy git clone $REPO $REMOTE_DIR
  else
    echo "Repo already cloned at $REMOTE_DIR"
  fi

  echo "--- Setting up .env (if not present)..."
  if [ ! -f "$REMOTE_DIR/.env" ]; then
    cp "$REMOTE_DIR/.env.example" "$REMOTE_DIR/.env"
    echo ""
    echo "*** ACTION REQUIRED: Fill in production values in $REMOTE_DIR/.env ***"
    echo "    Run: ssh deploy@$SSH_HOST nano $REMOTE_DIR/.env"
  fi

  echo ""
  echo "Bootstrap complete."
  echo "Next step: fill in $REMOTE_DIR/.env, then run ./deploy.sh"
ENDSSH
