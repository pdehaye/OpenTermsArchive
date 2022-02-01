# Open Terms Archive Ops

Recipes to set up the infrastructure for the Open Terms Archive app and deploy it.

> Recettes pour mettre en place l'infrastructure et déployer l'application Open Terms Archive

## Automatic build and deploy from Github

Although the following docs will show you how to deploy from your local machine, a CI process will deploy a new version of the app everytime a tag is created.

So if you want to benefit from this, create a new tag on the `master` branch with

```
npm version <patch|minor|major>
```

## Requirements

- Install [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)

### [For developement only] Additional dependencies

To test the changes without impacting the production server, a Vagrantfile is provided to test the changes locally in a virtual machine. VirtualBox and Vagrant are therefore required.

- Install [VirtualBox](https://www.vagrantup.com/docs/installation/)
- Install [Vagrant](https://www.vagrantup.com/docs/installation/)

#### On a Mac with an Apple Silicon processor

VirtualBox is not compatible with Apple Silicon (M1…) processors. You will thus need to use the Docker provider.

To that end, install Docker Desktop through a [manual install](https://hub.docker.com/editions/community/docker-ce-desktop-mac) or with `brew install homebrew/cask/docker`.

vagrant plugin install docker
vagrant up --provider=docker


vagrant halt # stop machine
vagrant ssh



## Usage

To avoid making changes on the production server by mistake, by default all commands will only affect the Vagrant development virtual machine (VM). Note that the VM needs to be started before with `vagrant up`.  If you’re on an Apple Silicon machine or want to use Docker instead of VirtualBox, type `vagrant up --provider=docker`.

To execute commands on the production server you should specify it by adding the option `--inventory ops/inventories/production.yml` to the following commands:

- To set up a full [(phoenix)](https://martinfowler.com/bliki/PhoenixServer.html) server:

```
ansible-playbook ops/site.yml
```

- To setup infrastructure only:

```
ansible-playbook ops/infra.yml
```

Setting up the production infrastructure for publishing on the shared versions repository entails decrypting a private key managed with [Ansible Vault](https://docs.ansible.com/ansible/latest/user_guide/vault.html). It is decrypted with a password that we keep safe. You do not need to decrypt this specific private key on your own production server.

- To setup `OpenTermsArchive` app only:

```
ansible-playbook ops/app.yml
```

Some useful options can be used to:

- see what changed with `--diff`
- simulate execution with `--check`
- see what will be changed with `--check --diff`

### Tags

Some tags are available to refine what will happen, use them with `--tags`:

- `setup`: to only setup system dependencies required by the app (cloning repo, installing app dependencies, all config files, and so on…)
- `start`: to start the app
- `stop`: to stop the app
- `restart`: to restart the app
- `update`: to update the app (pull code, install dependencies and restart app)
- `update-declarations`: to update services declarations (pull declarations, install dependencies and restart app)

For example, you can update `OpenTermsArchive` by running:

```
ansible-playbook ops/app.yml --tags update
```

### Logs

You can get logs by connecting to the target machine over SSH and obtaining logs from the process manager:

```
ssh user@machine pm2 logs ota
```

### Troubleshooting

If you have the following error:

```
Failed to connect to the host via ssh: ssh: connect to host 127.0.0.1 port 2222: Connection refused
```

You may have a collision on the default port `2222` used by vagrant to forward ssh commands.
Run the following command to know which ports are forwarded for the virtual machine:

```
vagrant port
```

It should display something like that:

```
The forwarded ports for the machine are listed below. Please note that
these values may differ from values configured in the Vagrantfile if the
provider supports automatic port collision detection and resolution.

    22 (guest) => 2200 (host)
```

Modify ansible ssh options to the `ops/inventories/dev.yml` file with the proper `ansible_ssh_port`:

```
all:
  children:
    dev:
      hosts:
        '127.0.0.1':
          […]
          ansible_ssh_port: 2200
          […]
```
