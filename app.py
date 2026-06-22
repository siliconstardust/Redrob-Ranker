import streamlit as st, json, sys, tempfile, os
sys.path.insert(0, "src")
from rank import run

st.title("Redrob Candidate Ranker")
f = st.file_uploader("Upload candidates.jsonl", type=["jsonl","json"])
if f:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jsonl") as tmp:
        tmp.write(f.read())
        tmp_path = tmp.name
    out_path = tmp_path.replace(".jsonl", "_out.csv")
    with st.spinner("Ranking..."):
        run(tmp_path, out_path, top_n=100)
    with open(out_path) as out:
        st.download_button("Download submission.csv", out.read(), "submission.csv")
    os.unlink(tmp_path)
