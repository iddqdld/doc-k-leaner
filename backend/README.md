# Structure commence 

core/config.py 
1) File size limit
2) File types limit (whitelist)
3) MIME types whitelist (Multipurpose Internet Mail Extension) 
ICI avec les mime il faut implementer le check contre le file rename (MIME type change pas meme si on a change le nom de ficher)
Example : qqch.exe rename cfg.yaml (il va passer le .yml check, mais MIME will be .exe still)

schemas/fileupload.py
definition de BaseModel pour utiliser pydantic to validate and tag all the data we recieve.
en generale c un fichier pour definire le format de data, on va lui utiliser en creation de nos function API.

Gab V specifiquement pour toi par example le nettoyage de data part 
Convert to JSON string
    metadata.model_dump_json()  # '{"file_id": "abc", "filename": "test.yml", "size": 1024}'
il y a beacoup plus de fonctionalite dans pydantic on a definie que la structure la pour tout future developement.
