import streamlit as st
import os
import uuid
import requests
from requests import RequestException

# 1. Fonction Placeholder pour votre logique d'analyse
# C'est ici que vous connecterez votre moteur d'analyse réel
def scan_malware(file_path):
    """
    Simule l'analyse. Remplacez ceci par votre vrai code.
    Retourne un dictionnaire de résultats.
    """
    # Exemple : Appel à un script externe, YARA, ou API VirusTotal
    import time
    time.sleep(2)  # On simule le temps de traitement

    # Logique factice pour l'exemple
    file_size = os.path.getsize(file_path)
    if file_size == 0:
        return {"status": "Erreur", "details": "Fichier vide"}

    return {
        "status": "Clean",
        "threat_level": "None",
        "details": f"Analysé {file_path} avec succès."
    }


# 2. Interface Utilisateur (UI)
st.title("Analyse de Menaces")

# Zone de Drag & Drop
uploaded_file = st.file_uploader(
    "Drag & Drop Pour Une Analyse Instantanée",
    help="Glissez vos fichiers ici"
)


# 3. Logique de déclenchement (Dès qu'un fichier est là)
if uploaded_file is not None:
    # Création d'un dossier temporaire dans le conteneur Docker
    temp_dir = "temp_analysis"
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir, exist_ok=True)

    # Chemin complet du fichier
    file_path = os.path.join(temp_dir, uploaded_file.name)

    # Écriture du fichier sur le disque (depuis la RAM)
    with open(file_path, "wb") as f:
        f.write(uploaded_file.getbuffer())

    # Générer un identifiant local pour le fichier (Streamlit n'expose pas file_id)
    file_id = str(uuid.uuid4())
    st.success(f"Fichier '{uploaded_file.name}' téléchargé avec succès ! ID: {file_id}")

    # Indicateur de chargement pendant l'analyse (via backend)
    backend_url = os.environ.get("DOCKCLEANER_API", "http://localhost:8000")
    scan_endpoint = f"{backend_url}/api/scan"

    with st.spinner('Analyse des menaces en cours (backend)...'):
        try:
            files = {"file": (uploaded_file.name, uploaded_file.getbuffer())}
            resp = requests.post(scan_endpoint, files=files, timeout=120)
            resp.raise_for_status()
            result = resp.json()

            # Affichage des résultats
            st.write("---")
            st.subheader("Résultat de l'analyse")

            if result.get("status") == "Clean":
                st.success("✅ Aucune menace détectée")
            else:
                st.error("⚠️ Menace potentielle détectée")

            st.json(result)

        except RequestException as e:
            st.error(f"Erreur réseau vers le backend: {e}")
        except Exception as e:
            st.error(f"Erreur lors de l'analyse: {e}")
        finally:
            # Nettoyage local du fichier temporaire
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)

                if os.path.isdir(temp_dir) and not os.listdir(temp_dir):
                    os.rmdir(temp_dir)
            except Exception:
                pass
