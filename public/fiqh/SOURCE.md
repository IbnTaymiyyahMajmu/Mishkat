# Where these files come from

They are worked out by `scripts/build-fiqh.mjs` from the digital text of four
works of fiqh, as held by the Open Islamicate Texts Initiative:

- **al-Mughnī** of Ibn Qudāma al-Maqdisī (d. 620 AH), Maktabat al-Qāhira, 1388/1968,
  ten volumes. OpenITI `0620IbnQudamaMaqdisi.Mughni.Shamela0008463-ara1`.
- **al-Mubdiʿ fī sharḥ al-Muqniʿ** of Burhān al-Dīn Ibn Mufliḥ (d. 884 AH), Dār
  al-Kutub al-ʿIlmiyya, 1418/1997, eight volumes. OpenITI
  `0884AbuIshaqIbnMuflih.MubdicFiSharhMuqnic.Shamela0021619BK2-ara1`.
- **al-Mabsūṭ** of Shams al-Aʾimma al-Sarakhsī (d. 483 AH), Dār al-Maʿrifa, Beirut,
  1414/1993, thirty volumes. OpenITI `0483IbnAhmadSarakhsi.Mabsut.Shamela0005423-ara1`.
- **Badāʾiʿ al-ṣanāʾiʿ** of ʿAlāʾ al-Dīn al-Kāsānī (d. 587 AH), Dār al-Kutub al-ʿIlmiyya,
  second edition, 1406/1986, seven volumes. OpenITI
  `0587IbnMascudCalaDinKasani.BadaicSanaic.Shamela0008183-ara1`.

All four were typed by al-Maktaba al-Shāmila (shamela.ws), whose page numbers the
links here follow. OpenITI publishes its corpus under Creative Commons
Attribution-NonCommercial-ShareAlike 4.0
(<https://creativecommons.org/licenses/by-nc-sa/4.0/>), and these files are
shared on the same terms. Cite it as: Romanov, Maxim, and Masoumeh Seydi,
"OpenITI: A Machine-Readable Corpus of Islamicate Texts", Zenodo,
doi:10.5281/zenodo.3082463. The change made here: the texts were cut into the
sections and paragraphs that quote the Qurʾān, and gathered under the ayat they
quote.

- `places/<surah>.json` — for every ayah, each place the books quote it.
- `<book>/<n>.json` — those sections whole, 16 to a file.
