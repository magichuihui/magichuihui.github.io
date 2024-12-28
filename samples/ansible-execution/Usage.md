## Build Ansible execution environment

```bash
ansible-builder create -f execution-environment.yml

docker build -t ansible-ee context/
```