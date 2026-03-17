instruction on how to use scirpts.

if u are not sure about why would you use them, ask me before using. 

il faut utiliser sudo pour tout les commands

the postgres container needs to be running ofc to be able to restore the db

running 
    sudo bash docker/scripts/db_dump.sh 
creates a timestamped dump in docker/data/postgres-backups/ folder. 
we are gonna have a ready dump wich will have already all usecases in it. so generally u don't have to do this part. 

then we want to load this dump to see all the data when launching containers. 
    docker/scripts/db_restore.sh docker/db-snapshots/<name of the dump file here> 
then you can start the app like usual.

https://raw.githubusercontent.com/aquasecurity/trivy/main/pkg/fanal/secret/builtin-rules.go

i used some of the rulesets from here to populate our trivy-sercret rules sets