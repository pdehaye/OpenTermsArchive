# -*- mode: ruby -*-
# vi: set ft=ruby :

$customAppleSiliconScript = <<-SCRIPT
echo Updating apt...
sudo apt-get update
echo Installing python...
sudo apt-get install python3 python3-pip -y
SCRIPT

# Vagrant.configure("2") do |config|
#   # config.vm.box = "debian/bullseye64"
#   config.vm.box = "ubuntu/bionic64"
#   # config.vm.provision "ansible" do |ansible|
#   #   ansible.playbook = "ops/site.yml"
#   # end

#   # Provider for Docker, necessary for Apple Silicon chips
#   config.vm.provider :docker do |docker, override|
#     override.vm.box = nil
#     docker.image = "rofrano/vagrant-provider:provider:ubuntu"
#     # docker.image = "rofrano/vagrant-provider:debian"
#     docker.remains_running = false
#     docker.has_ssh = true
#     docker.privileged = true
#     docker.volumes = ["/sys/fs/cgroup:/sys/fs/cgroup:ro"]

#     # Define Ansible variables specific to this VM.
#     # ansible.inventory = "ops/inventories/dev-silicon.yml"
#     # ansible.host_vars = {
#     #   "ansible_ssh_private_key_file" => ".vagrant/machines/default/docker/private_key",
#     # }
#   end
# end


# In order to use this you need to
# - launch docker on your Apple M1 

# Then in OpenTermsArchive

# git pull --rebase
# git checkout applesilicon
# vagrant destroy -f
# rm -Rf .vagrant/
# vagrant up --provider=docker

# And Then

# First problem is
# - provisioner is running many times before stopping (see in the logs after last command)

# Then, launch

# ansible-playbook ops/site.yml --inventory ops/inventories/dev-applesilicon.yaml

# - and get "Unable to locate package mongodb-org"

# Any idea appreciated

Vagrant.configure("2") do |config|
  config.vm.hostname = "debian"

  # config.vm.box = "ubuntu/bionic64" # No package matching 'chromium' is available
  # config.vm.box = "debian/buster" # No package matching 'mongodb-org' is available
  config.vm.box = "debian/bullseye64" # Unable to locate package mongodb-org

  config.vm.provider :docker do |docker, override|
    override.vm.box = nil
    docker.image = "rofrano/vagrant-provider:debian"
    docker.remains_running = true
    docker.has_ssh = true
    docker.privileged = true
    docker.volumes = ["/sys/fs/cgroup:/sys/fs/cgroup:rw"]
    docker.create_args = ["--cgroupns=host"]

    # python is not installed by default in the vagrant-provider image
    # and depoying result in  /bin/sh: 1: /usr/bin/python: not found
    # use a provision to fix that
    config.vm.provision "shell", inline: $customAppleSiliconScript
    
    # Uncomment to force arm64 for testing images on Intel
    # CAREFUL: using this ends up with "default: Warning: Remote connection disconnect. Retrying..." when vagran up
    # docker.create_args = ["--platform=linux/arm64"]     
    
    # Does not fix above problem
    # config.ssh.insert_key = false
    # config.ssh.private_key_path = ["~/.ssh/id_rsa", "~/.vagrant.d/insecure_private_key"]
    # config.vm.provision "file", source: "~/.ssh/id_rsa.pub", destination: "~/.ssh/authorized_keys"
    # config.ssh.username = "vagrant"
    # config.ssh.password = "vagrant"
  end  
end

# config.vm.box = "ubuntu/bionic64"
