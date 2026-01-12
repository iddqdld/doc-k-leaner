# Structure commence 

core/config.py 
1) File size limit
2) File types limit (whitelist)
3) MIME types whitelist (Multipurpose Internet Mail Extension) 
ICI avec les mime il faut implementer le check contre le file rename (MIME type change pas meme si on a change le nom de ficher)
Example : qqch.exe rename cfg.yaml (il va passer le .yml check, mais MIME will be .exe still)