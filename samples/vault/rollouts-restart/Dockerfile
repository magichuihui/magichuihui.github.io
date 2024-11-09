FROM hashicorp/vault:1.17.2

USER root
RUN sed -i 's/https/http/' /etc/apk/repositories && apk --no-cache add curl

USER vault
COPY delete_pod.sh /opt/delete_pod.sh
