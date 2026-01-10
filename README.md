# doc-k-leaner

# git instruction

when the repo is cloned you go to the dev branch
ALL WORK SHOULD BE DONE FROM DEV BRUNCH!!!
main brunch is for stable version after testig, as I do testing, i made it so only i can merge to dev to MAIN to avoid errors.

all work should be done like this 
-----------------------------------------------------------------------------------------
    git checkout dev 
    git pull origin dev
    git checkout -b feature/nom de truc que vous develope

# quand le truc est pret

    git add .
    git commit -m "description de truc que vous avez fait"
    git push origin feature/nom de truc que vous develope
------------------------------------------------------------------------------------------
Apres il faut passez par le site de github
Creez PR request feature/... --> dev
Aprez fait le review sur ce que vous ajoute et tag @ moi pour question et pour que je pourais commencer testing.
REPETEZ ca pour CHAQUE truc que vous develope!
SEPARE vos future dans les branches diffirents! Pour clarite.
JE VEUX PAS VOIR +5000 -2102 ligne dans le RP, serait inpossible de rester claire et faire le review + testing.
 
# docker usage

do not under any curcumnstances change docker images apart from adding additional dependencies if needed. 

fait la documentation pour tous les trucs que vous ajoute, comme ca on pourrait savoir ce que vous pensez en realisant le function.
vous avez un fichier README dans votre folder pour ca.

fait attention a bien push tous vos features quand ils sont bien fonctionelle. n'oublie pas verifie que vos changement ne rester pas dans gitignore.

# git tree 

to use in the current repo only type this in bash

    git config alias.tree "log --graph --decorate --pretty=oneline --abbrev-commit"  

to use in the global config

    git config --global alias.tree "log --graph --decorate --pretty=oneline --abbrev-commit"  