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
 
