"""Synthetic DEMO documents so Squad 4 can build the timeline UI before real data lands.

Everything here is made up (GR numbers carry a DEMO prefix) and must never be
shown as real government data.
"""
from __future__ import annotations

from datetime import date

from .graph import LineageGraph
from .schemas import DocumentIn, PageText


def demo_documents() -> list[DocumentIn]:
    return [
        DocumentIn(
            doc_id="demo-2014-001",
            gr_number="DEMO-GAD-2014-001",
            department="General Administration Department",
            subject="[DEMO] Maternity leave for Class 1 officers",
            issue_date=date(2014, 3, 12),
            language="en",
            pages=[
                PageText(
                    page=1,
                    text="Resolution No. DEMO-GAD-2014-001 dated 12/03/2014.\n"
                    "Class 1 women officers are eligible for 180 days of maternity leave.",
                )
            ],
        ),
        DocumentIn(
            doc_id="demo-2018-045",
            gr_number="DEMO-GAD-2018-045",
            department="General Administration Department",
            subject="[DEMO] Maternity leave: documents required",
            issue_date=date(2018, 5, 20),
            language="en",
            pages=[
                PageText(page=1, text="Resolution No. DEMO-GAD-2018-045 dated 20/05/2018."),
                PageText(
                    page=2,
                    text="In partial modification of GR No. DEMO-GAD-2014-001 dated 12/03/2014, "
                    "a medical certificate shall be submitted with the leave application.",
                ),
            ],
        ),
        DocumentIn(
            doc_id="demo-2021-130",
            gr_number="DEMO-GAD-2021-130",
            department="General Administration Department",
            subject="[DEMO] Revised maternity leave provisions",
            issue_date=date(2021, 8, 2),
            language="en",
            pages=[
                PageText(
                    page=1,
                    text="Resolution No. DEMO-GAD-2021-130 dated 02/08/2021.\n"
                    "This Resolution supersedes GR No. DEMO-GAD-2018-045 dated 20/05/2018.",
                )
            ],
        ),
        DocumentIn(
            doc_id="demo-2019-gu-009",
            gr_number="DEMO-જસવ-2019-9",
            department="સામાન્ય વહીવટ વિભાગ",
            subject="[DEMO] રજા નિયમો",
            issue_date=date(2019, 1, 15),
            language="gu",
            pages=[
                PageText(
                    page=1,
                    text="તા.૧૨/૦૩/૨૦૧૨ ના ઠરાવ ક્રમાંક: DEMO-જસવ-૨૦૧૨-૯ ને રદ કરવામાં આવે છે.",
                )
            ],
        ),
    ]


def load_demo(graph: LineageGraph) -> None:
    for doc in demo_documents():
        graph.add_document(doc)
