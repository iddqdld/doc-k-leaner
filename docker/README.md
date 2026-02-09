instruction on how to use scirpts.

if u are not sure about why would you use them, ask me before using. 

running 
    docker/scripts/db_dump.sh 
creates a timestamped dump in docker/data/postgres-backups/ folder. 
we are gonna have a ready dump wich will have already all usecases in it. so generally u don't have to do this part. 

then we want to load this dump to see all the data when launching containers. 
    docker/scripts/db_restore.sh <name of the dump file here>
then you can start the app like usual.