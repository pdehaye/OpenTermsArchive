# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "debian/bullseye64"

  # config.vm.provision "ansible" do |ansible|
  #   ansible.playbook = "ops/site.yml"
  # end

  # Provider for Docker, necessary for Apple Silicon chips
  config.vm.provider :docker do |docker, override|
    override.vm.box = nil
    docker.image = "rofrano/vagrant-provider:debian"
    docker.remains_running = true
    docker.has_ssh = true
    docker.privileged = true
    docker.volumes = ["/sys/fs/cgroup:/sys/fs/cgroup:ro"]

    # Define Ansible variables specific to this VM.
    # ansible.inventory = "ops/inventories/dev-silicon.yml"
    # ansible.host_vars = {
    #   "ansible_ssh_private_key_file" => ".vagrant/machines/default/docker/private_key",
    # }
  end
end
