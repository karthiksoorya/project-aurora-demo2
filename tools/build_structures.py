"""Build curated 3D structure fixtures for single compounds.

Input: the SMILES strings below (curated by hand for this demo).
Output: apps/api/src/fixtures/structures.json

Each structure records how it was produced so the UI can show provenance:
  - the SMILES actually used,
  - a 3D conformer computed with RDKit ETKDGv3 (randomSeed fixed => deterministic) + MMFF94 cleanup,
  - the molecular formula and average MW computed *from the SMILES*, and
  - whether that computed formula matches the formula declared in the fixture (consistency check).

This is NOT an experimentally determined structure and NOT a registry lookup. The registry
check (e.g. PubChem/CAS) is recorded as 'pending' until a trusted source is configured.
Natural mixtures (essential oils) deliberately have no entry here.

Run:  pip install rdkit  &&  python tools/build_structures.py
"""
import json
import os
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors

COMPOUNDS = {
    # id: (display name, SMILES, declared formula)
    "cmp-limonene": ("(R)-(+)-Limonene", "CC1=CC[C@@H](CC1)C(=C)C", "C10H16"),
    "cmp-linalool": ("Linalool", "CC(C)=CCCC(C)(O)C=C", "C10H18O"),
    "cmp-linalyl-acetate": ("Linalyl acetate", "CC(=CCCC(C)(C=C)OC(C)=O)C", "C12H20O2"),
    "cmp-vanillin": ("Vanillin", "COc1cc(C=O)ccc1O", "C8H8O3"),
    "cmp-calone": ("Calone (methylbenzodioxepinone)", "Cc1ccc2OCC(=O)COc2c1", "C10H10O3"),
    "cmp-hedione": ("Methyl dihydrojasmonate (Hedione)", "CCCCCC1C(CC(=O)OC)CCC1=O", "C13H22O3"),
    "cmp-cis-3-hexenol": ("cis-3-Hexen-1-ol", "CC/C=C\\CCO", "C6H12O"),
    "cmp-gamma-decalactone": ("gamma-Decalactone", "CCCCCCC1CCC(=O)O1", "C10H18O2"),
}

def build(cid, name, smiles, declared):
    mol = Chem.MolFromSmiles(smiles)
    computed = rdMolDescriptors.CalcMolFormula(mol)
    mw = round(Descriptors.MolWt(mol), 2)
    from rdkit.Chem import rdDepictor
    m2 = Chem.Mol(mol)
    rdDepictor.SetPreferCoordGen(True)
    rdDepictor.Compute2DCoords(m2)
    c2 = m2.GetConformer()
    depiction = {
        "atoms": [{"el": a.GetSymbol(), "x": round(c2.GetAtomPosition(i).x, 3), "y": round(c2.GetAtomPosition(i).y, 3)} for i, a in enumerate(m2.GetAtoms())],
        "bonds": [{"a": b.GetBeginAtomIdx(), "b": b.GetEndAtomIdx(), "order": b.GetBondTypeAsDouble(), "aromatic": b.GetIsAromatic()} for b in m2.GetBonds()],
    }
    molh = Chem.AddHs(mol)
    params = AllChem.ETKDGv3()
    params.randomSeed = 42
    AllChem.EmbedMolecule(molh, params)
    AllChem.MMFFOptimizeMolecule(molh)
    conf = molh.GetConformer()
    pts = [conf.GetAtomPosition(i) for i in range(molh.GetNumAtoms())]
    cx = sum(p.x for p in pts) / len(pts); cy = sum(p.y for p in pts) / len(pts); cz = sum(p.z for p in pts) / len(pts)
    atoms = [{"el": a.GetSymbol(), "x": round(pts[i].x - cx, 3), "y": round(pts[i].y - cy, 3), "z": round(pts[i].z - cz, 3)}
             for i, a in enumerate(molh.GetAtoms())]
    bonds = [{"a": b.GetBeginAtomIdx(), "b": b.GetEndAtomIdx(), "order": b.GetBondTypeAsDouble()} for b in molh.GetBonds()]
    return {
        "compoundId": cid,
        "name": name,
        "smiles": smiles,
        "declaredFormula": declared,
        "computedFormula": computed,
        "computedMolecularWeight": mw,
        "formulaConsistent": computed == declared,
        "atoms": atoms,
        "bonds": bonds,
        "depiction2d": depiction,
        "provenance": {
            "method": "RDKit ETKDGv3 conformer (randomSeed=42) + MMFF94 optimisation from curated SMILES",
            "rdkitVersion": Chem.rdBase.rdkitVersion,
            "registryCheck": "pending",
            "note": "Computed conformer for visualisation only; not an experimentally determined structure.",
        },
    }

out = [build(cid, *v) for cid, v in COMPOUNDS.items()]
bad = [s["compoundId"] for s in out if not s["formulaConsistent"]]
if bad:
    raise SystemExit(f"Formula mismatch for {bad}; fix SMILES or declared formula")
path = os.path.join(os.path.dirname(__file__), "..", "apps", "api", "src", "fixtures", "structures.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1)
for s in out:
    print(s["compoundId"], s["computedFormula"], s["computedMolecularWeight"], len(s["atoms"]), "atoms")
