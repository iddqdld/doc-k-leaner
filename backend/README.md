# Structure commence 

we are using docstring called by """ comment """ so we have docs up to date compiled using OpenAPI they also good for describind each function you can see them in code too.
---
core/config.py 
1) File size limit
2) File types limit (whitelist)
3) MIME types whitelist (Multipurpose Internet Mail Extension) 
ICI avec les mime il faut implementer le check contre le file rename (MIME type change pas meme si on a change le nom de ficher)
Example : qqch.exe rename cfg.yaml (il va passer le .yml check, mais MIME will be .exe still)

---
schemas/fileupload.py
core logic defined in this file

definition de BaseModel pour utiliser pydantic to validate and tag all the data we recieve.
en generale c un fichier pour definire le format de data, on va lui utiliser en creation de nos function API.
when we parse them as two entries, the program is more optimized (memory usage wise, as we read metadata more often than content)

Gab V specifiquement pour toi par example le nettoyage de data part 
Convert to JSON string
    metadata.model_dump_json()  # '{"file_id": "abc", "filename": "test.yml", "size": 1024}'
il y a beacoup plus de fonctionalite dans pydantic on a definie que la structure la pour tout future developement.

So, we are using pipeline method to send both parts toghether to our redis server, so we don't get corrupted data if smth happens betwen sending part1(metadata) and part2(content) (ex. server crash). we are prepering them and then sending, this permits us to have all or nothing result. we either got everything or nothing. 
---
api/files.py
pretty selfexplanatory, better to check the file to get more info

added links normalisation for github and gitlab. 

schemas/admin.py 
admin dashboard api

db --> is postgre init

added storage service and db service files in ./services 
they are additional files to connect postgre storage

+ psycopg[binary] in requirements so we can talk with our db.