"""One test per row of the resolution table (plan section 4.4)."""
from datetime import date

from app.lineage.extract import ReadItem, Refs
from app.lineage.resolve import Resolver, subject_similarity
from app.schemas import Confidence, GRRecord
from app.store.corpus import Corpus

E, P = Confidence.EXPLICIT, Confidence.PROBABLE


def gr(gid, number, dept, d, subject):
    return GRRecord(gr_id=gid, gr_number=number, department=dept, issue_date=d, subject=subject)


CORPUS = Corpus({g.gr_id: g for g in [
    gr("A", "GAD/2010/01", "GAD", date(2010, 1, 1), "daily allowance on tour"),
    gr("B", "FIN/2011/02", "FIN", date(2011, 5, 5), "medical ceiling"),
    gr("C", "FIN/2012/03", "FIN", date(2012, 6, 6), "medical reimbursement ceiling"),
    gr("D", "HLT/2012/04", "HLT", date(2012, 6, 6), "hospital rates"),
    gr("E", "GAD/2012/05", "GAD", date(2012, 6, 6), "daily allowance on tour"),
    gr("NEW", "GAD/2020/09", "GAD", date(2020, 1, 1), "daily allowance on tour"),
]})
R = Resolver(CORPUS)
NEW = CORPUS.get("NEW")


def one(refs, items=None):
    out = R.resolve(refs, NEW, items or [])
    assert len(out) == 1, out
    return out[0]


def test_exact_gr_number_is_explicit():
    t = one(Refs(numbers=["GAD/2010/01"]))
    assert (t.gr_id, t.confidence) == ("A", E)


def test_gr_number_separator_variants_match():
    assert one(Refs(numbers=["GAD-2010-01"])).gr_id == "A"


def test_date_plus_department_is_explicit():
    t = one(Refs(dates=[date(2011, 5, 5)], dept_hints=["FIN"]))
    assert (t.gr_id, t.confidence) == ("B", E)


def test_date_only_single_match_is_probable():
    t = one(Refs(dates=[date(2011, 5, 5)]))
    assert (t.gr_id, t.confidence) == ("B", P)


def test_date_matching_several_picks_closest_subject_and_flags():
    t = one(Refs(dates=[date(2012, 6, 6)]))  # C, D, E share the date; NEW's subject matches E
    assert (t.gr_id, t.confidence) == ("E", P) and "closest subject" in t.note


def test_blanket_targets_same_department_similar_subject_and_capped():
    new = gr("FINNEW", "FIN/2020/01", "FIN", date(2020, 1, 1), "medical reimbursement ceiling")
    targets = R.blanket(new)
    assert [t.gr_id for t in targets] == ["C", "B"] and all(t.confidence == P for t in targets)
    many = Corpus({f"G{i}": gr(f"G{i}", f"X/{i}", "X", date(2000 + i % 9, 1, 1), "same subject here") for i in range(9)})
    assert len(Resolver(many).blanket(gr("N", "X/99", "X", date(2020, 1, 1), "same subject here"))) == 5


def test_number_not_in_corpus_is_a_broken_link():
    t = one(Refs(numbers=["GAD/1999/99"]))
    assert t.gr_id is None and t.ref_text == "GAD/1999/99"


def test_date_with_no_matching_gr_is_a_broken_link():
    assert one(Refs(dates=[date(1999, 1, 1)])).gr_id is None


def test_garbled_number_falls_back_to_date():
    t = one(Refs(numbers=["GAD/2O10/01"], dates=[date(2010, 1, 1)]))
    assert (t.gr_id, t.confidence) == ("A", P)


def test_read_pointer_resolves_through_the_reference_list():
    t = one(Refs(pointers=[2]), [ReadItem(1, "GR FIN/2011/02", "x"), ReadItem(2, "GR GAD/2010/01 dated 01/01/2010", "x")])
    assert t.gr_id == "A" and t.ref_text.startswith("Read (2)")


def test_pointer_to_missing_item_gives_nothing():
    assert R.resolve(Refs(pointers=[7]), NEW, []) == []


def test_self_reference_is_ignored():
    assert R.resolve(Refs(numbers=["GAD/2020/09"]), NEW, []) == []


def test_nothing_usable_gives_no_targets():
    assert R.resolve(Refs(), NEW, []) == []


def test_subject_similarity():
    assert subject_similarity("Daily allowance on tour", "daily allowance for tour") > 0.5
    assert subject_similarity("a b", None) == 0.0


def test_number_with_a_different_year_is_a_broken_link():
    corpus = Corpus({g.gr_id: g for g in [
        gr("K25", "KP/51", "PRHRDD", date(2025, 3, 1), "rules"),
        gr("K14", "KP/51", "PRHRDD", date(2014, 12, 3), "draft rules"),
        gr("NEW", "KP/60", "PRHRDD", date(2025, 6, 1), "rules"),
    ]})
    refs = Refs(numbers=["KP/51"], number_years={"KP/51": 2014})
    out = Resolver(corpus).resolve(refs, corpus.get("NEW"), [])
    assert [t.gr_id for t in out] == ["K14"]
    refs = Refs(numbers=["KP/70"], number_years={"KP/70": 2010})
    assert Resolver(corpus).resolve(refs, corpus.get("NEW"), [])[0].gr_id is None
