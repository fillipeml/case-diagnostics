# Glossary

The case files are Brazilian and Portuguese; the product is English. What stays in Portuguese, and why, plus the legal terms behind the English identifiers.

## The pleadings the extractor looks for

| Portuguese (as in the file) | Key in `extract.ts` | What it is |
|---|---|---|
| Petição inicial | `complaint` | The plaintiff's opening pleading: facts, law, claims. Opens with "vem, respeitosamente, à presença de Vossa Excelência". |
| Contestação | `defence` | The defendant's answer. The plaintiff's later rebuttal may also call itself "contestação", so this section is only taken near the client's name. |
| Sentença | `judgment` | The first-instance decision. "É o relatório. Decido." separates the summary from the reasoning; "JULGO PARCIALMENTE PROCEDENTE" opens the operative part. |
| Razões de apelação | `appeal` | The grounds of an appeal against the judgment. |
| Embargos de declaração | `motion` | A motion for clarification of a decision. |
| Acórdão | `appellate` | The appellate court's decision, opened by "ACORDAM os Desembargadores". |
| Recurso especial | `special` | The appeal to the Superior Court of Justice (STJ) on federal law. |

## Legal terms in the diagnoses

| Term | Meaning |
|---|---|
| Loteamento | A lot development: land divided into lots sold with infrastructure works to be built, governed by Lei 6.766/79. |
| Alienação fiduciária (fiduciary lien) | Ownership of the lot stays with the creditor until the price is paid; Lei 9.514/97 sets a special out-of-court procedure (arts. 26 and 27) for default, which is why an ordinary rescission action can be the wrong procedure. |
| CDC | The consumer code (Código de Defesa do Consumidor), often applied alongside the special laws; art. 6, VIII allows the court to reverse the burden of proof; art. 51, IV voids abusive clauses. |
| Súmula 543 do STJ | Precedent: when a lot purchase is terminated, the amounts paid are refunded at once, in full if the seller caused it and in part if the buyer did. |
| Cláusula penal / retenção | The penalty clause of the contract, usually a percentage retained from the amounts paid; contracts before Lei 13.786/2018 typically end with a court-set retention around 25%. |
| Ultra petita (art. 492 CPC) | A judgment that grants more than what was asked. The map compares the exact request with the exact award. |
| Art. 85, §11 CPC | Fees increased on appeal against the losing appellant; "majoro os honorários" is the phrase the map looks for. |
| Lucros cessantes | Lost profits, presumed by case law on late delivery of a home (TJSP Súmulas 161 and 162); whether the presumption fits a bare lot is a live question. |
| Danos morais | Moral damages; a mere breach of contract does not cause them, which is why they are so often a defence win and never a gap. |
| TVO | Termo de Verificação de Obras: the municipality's certificate that the infrastructure works are complete. |
| IPTU | Municipal property tax. |
| Taxas associativas | Association fees in gated lot developments; due only with express adhesion or a note on the property record (STF Tema 492, STJ Temas 882 and 1183). |
| Inovação recursal (art. 1.014 CPC) | An argument raised for the first time on appeal, which the court will not hear. |
| Preparo (art. 1.007 CPC) | The court fee of an appeal; a failure to pay makes the appeal fragile. |

## Thesis categories

| Code | Original code | Meaning |
|---|---|---|
| `unanswered_claim` | impugnacao_ausente | The plaintiff alleged; the defence did not answer. |
| `unused_evidence` | prova_nao_utilizada | Evidence that existed and was not filed. |
| `ground_not_attacked` | fundamento_nao_atacado | A ground of the decision the appeal did not attack. |
| `free_argument` | argumento_livre | A legally possible thesis never raised. |
| `fragile_appeal` | estrutura_recursal_fragil | A formal problem: new argument, fees, deadline. |
| `possible_legal_thesis` | tese_juridica_possivel | A thesis with legal or case-law support that could change the outcome. |

Levels: complexity and risk are `low`, `medium`, `high` (originally Baixa/Média/Alta and Baixo/Médio/Alto).
