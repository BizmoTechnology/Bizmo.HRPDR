# Sektörel Soru Şablonları — Talaşlı İmalat

Talaşlı imalat için dört rol şablonu: CNC Operatörü, Depo Personeli, Bakım Personeli ve Beyaz Yaka. Her şablon bir soru seti ve soru havuzundaki sorulardan oluşur.

- **Kaynak kod:** `server/prisma/sector-templates/`
- **Yükleme:**
  - Yeni kurulumda `npm run db:seed` şablonları da ekler.
  - Mevcut veritabanında `npm run db:seed:sector` çalıştırın.
  - İkisi de idempotent ve yalnız ekleme yapar: var olan sete (İK düzenlemiş ya da silmiş olsa bile) ve var olan soruya dokunulmaz.

> **Durum:** Bu şablonlar uluslararası çerçevelere dayanan **taslak** ölçme araçlarıdır. Türkçe uyarlamaları için henüz pilot uygulama, güvenirlik analizi ya da norm çalışması yapılmamıştır (bkz. [Uygun kullanım](#uygun-kullanım-iso-10667-ve-itc)). Sonuçlar karar desteğidir. Tek başına işe alma, terfi ya da işten çıkarma gerekçesi olamaz.

## Setler

Boyut ağırlıklarında kısaltmalar: M = Mantıksal, L = Liderlik, S = Sosyal, G = Gelişim, A = Alan uyumu.

| Set | O*NET kodu | Soru | Boyut ağırlıkları (M/L/S/G/A) | Tip dağılımı (Skala / Ç.Seçmeli / Durumsal / Davranışsal / Açık uçlu) | Puanlama kuralı olan soru |
|---|---|---|---|---|---|
| CNC Operatörü | 51-9161.00 | 39 | 25/10/15/20/30 | 14 / 11 / 4 / 4 / 6 | 6 ters madde, 10 anahtarlı |
| Depo Personeli | 53-7065.00, 43-5071.00 (forklift: 53-7051.00) | 37 | 20/10/20/15/35 | 13 / 13 / 3 / 3 / 5 | 6 ters madde, 12 anahtarlı |
| Bakım Personeli | 49-9041.00 (ayrıca 49-9071.00) | 37 | 30/10/15/15/30 | 14 / 11 / 3 / 3 / 6 | 6 ters madde, 10 anahtarlı |
| Beyaz Yaka (Ofis ve Mühendislik) | 11-3051.00, 17-2112.00 | 39 | 25/25/20/15/15 | 15 / 11 / 4 / 4 / 5 | 7 ters madde, 10 anahtarlı |

**Aşamalar:** Her set 4 buz kırma sorusuyla açılır. Ardından ana bölüm gelir, en sonda 2–3 kapanış sorusu vardır. Ters maddeler ve aynı yapıyı ölçen sorular ana bölüme dağıtılmıştır. Böylece hep "katılıyorum" deme eğilimi ve yorgunluk etkisi azalır.

**Ağırlıkların gerekçesi:**
- **Mavi yaka:** O*NET'te iş bilgisi, güvenlik ve dikkat/ayrıntı ağırlıklı meslekler olduğundan *Alan uyumu* yüksektir.
- **Bakım:** Arıza bulma ve analitik düşünme baskın olduğundan *Mantıksal* boyut yüksektir.
- **Beyaz yaka:** Bartram'ın "Leading & Deciding" ve "Analysing & Interpreting" faktörleri öne çıktığından *Liderlik* ve *Mantıksal* boyutlar yüksektir.

## Ölçülen yapılar, kaynakları ve lisans notları

Her sorunun `tags` alanı iki şeyi kaydeder:
- ölçtüğü yapıyı: `big5:*`, `onet:*`, `great8:*`, `guvenlik:*`, `konu:*`;
- dayandığı çerçeveyi: `ref:*`.

`ref:IPIP` etiketli maddeler IPIP maddelerinin Türkçe uyarlamasıdır. Diğer `ref:` etiketli maddeler o çerçevenin yapısını ölçmek için **özgün olarak yazılmıştır**.

| Yapı (etiket) | Ölçen sorular | Kaynak çerçeve | Lisans / kullanım notu |
|---|---|---|---|
| Big Five: sorumluluk, duygusal denge, uyumluluk, deneyime açıklık, dışadönüklük (`big5:*`) | Skala maddeleri (her sette 8–12) | IPIP (Goldberg, 1999; Goldberg ve ark., 2006) | **Kamu malı.** IPIP maddeleri izinsiz ve ücretsiz kopyalanabilir, çevrilebilir, uyarlanabilir. Maddeler iş bağlamına uyarlanmıştır (frame-of-reference; Shaffer ve Postlethwaite, 2012). |
| O*NET iş stilleri: dikkat/ayrıntı, güvenilirlik, dürüstlük, iş birliği, öz denetim, stres toleransı, uyum/esneklik, inisiyatif, azim, analitik düşünme, liderlik (`onet:*`) | Skala, SJT ve açık uçlu | O*NET (USDOL/ETA) meslek kodları ve iş stilleri | O*NET verileri **CC BY 4.0** ile lisanslıdır. Yalnız meslek kodları ve yapı adları kullanıldı; O*NET veri tablosu kopyalanmadı. Atıf: *"Includes information from O\*NET OnLine by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license."* |
| Mesleki bilgi (`bilgi`, `konu:*`) | Tek doğrulu çoktan seçmeli sorular: tolerans, ölçüm, ilk parça, SPC, FIFO/FEFO, 5S, LOTO, TPM, MTTR, OEE, MRP, 8D | Schmidt ve Hunter (1998): iş bilgisi testleri yüksek geçerlidir. Alan kaynakları: TPM (Nakajima, 1988), yalın üretim ve 5S (Ohno, 1988; Hirano, 1995), OSHA 29 CFR 1910.147 (LOTO) ve 1910.178 (forklift) | Sorular özgündür. OSHA metinleri ABD kamu malıdır. Standartlardan (AIAG, ISO) madde alınmadı. |
| Durumsal yargı (`sjt`) | Puan anahtarlı çoktan seçmeli sorular (her sette 5–6) | SJT yöntemi (Motowidlo, Dunnette ve Carter, 1990; McDaniel ve ark., 2001, 2007; Weekley ve Ployhart, 2006) | Yöntem serbesttir. Senaryolar ve anahtarlar özgündür. Anahtarlar **rasyonel/uzman taslağıdır**: en uygun 3, en uygunsuz 0. Kurum içi uzmanlarla doğrulanmalıdır. |
| Davranışsal örnek (`star`) | Davranışsal sorular (her sette 3–4) | Davranışsal olay görüşmesi (McClelland, 1998), örüntülü davranış betimleme görüşmesi (Janz, 1982), yapılandırılmış görüşme (Campion, Palmer ve Campion, 1997), STAR | Yöntem serbesttir, sorular özgündür. Takip yönlendirmesi `followUpPrompt` alanındadır. |
| Great Eight yetkinlikleri (`great8:*`) | Durumsal, davranışsal ve skala | Bartram (2005), *Journal of Applied Psychology*, 90(6) | Yalnız yayımlanmış sekiz faktör adı kullanıldı. SHL UCF/OPQ maddeleri kullanılmadı. |
| Güvenlik önceliği (`guvenlik:oncelik`) | "Acil işte güvenliği geri plana atmak normaldir" türü ters maddeler | Zohar (1980), Zohar ve Luria (2005): güvenlik ile üretim arasındaki öncelik | Yapı, kişinin kendi tutumu düzeyinde ölçülür; bu bir iklim ölçeği değildir. Zohar ölçek maddeleri **kopyalanmadı**. |
| Güvenlik uyumu ve katılımı (`guvenlik:uyum`, `guvenlik:katilim`) | Skala ve SJT | Griffin ve Neal (2000), Neal ve Griffin (2006) | Maddeler özgündür. Yayımlanmış ölçek maddeleri kopyalanmadı. |
| İlgi (`ilgi`, `puansiz`) | Her setin 2. sorusu | O*NET ilgi alanları (RIASEC) | Puanlanmaz. AI analizine bağlam olarak gider. |

**Kullanılmayan testler:** Wonderlic, Bennett Mekanik Kavrama, Raven, Hogan, OPQ, DISC ve MBTI gibi tescilli testlerden madde alınmadı ve bu testlerin maddeleri başka sözcüklerle yeniden yazılmadı. Sayısal ve mekanik akıl yürütme soruları (koli hesabı, OEE, kapasite, motor arızası) özgün iş örneği sorularıdır.

## Puanlama

Puanlama kuralı `Question.scoring` alanında tutulur (migration `20261015120000_question_scoring`). Kural personele gönderilmez ve oturum başındaki soru seti anlık görüntüsüne (snapshot) kopyalanır.

| Soru | Kural | 0–10 skor |
|---|---|---|
| Skala (1–5) | yok | (değer − min) / (max − min) × 10 |
| Skala, ters madde | `{ "reverse": true }` | (max − değer) / (max − min) × 10 |
| Çoktan seçmeli, puan anahtarlı | `{ "key": { "A": 1, "B": 3, … } }` | (seçenek puanı − en düşük) / (en yüksek − en düşük) × 10 |
| Çoktan seçmeli, anahtarsız; durumsal, davranışsal ve açık uçlu | — | Deterministik skor yok. AI analizi İK onayından sonra yapılır. |

- Boyut skoru, deterministik skorların soru ağırlığına göre ortalamasıdır (`computeScaleScores`). Kuralı olmayan eski sorular eskisi gibi puanlanır.
- İK onaylarsa AI'ın önerdiği boyut skorları bu skorlarla birleştirilir (`mergeDimensionScores`).
- **Ters maddeler:** Tutarlı cevaplayan kişi uç puanlar alır. Her maddeye "katılıyorum" diyen kişi orta puanda kalır. Bu, onaylama eğilimini (acquiescence) sınırlar ama sosyal beğenirlik etkisini gidermez. Skala puanları STAR cevaplarındaki kanıtla birlikte yorumlanmalıdır.
- **AI analizi:** AI'a giden cevap metninde ters madde ve anahtar puanı belirtilir.
- **İK paneli:** Oturum detayında ham değer (ör. 4/5), 0–10 skor ve anahtar puanı gösterilir.
- **Soru API'si:** `POST/PUT /api/questions` isteklerinde `scoring` alanı tip ve seçeneklerle birlikte doğrulanır. Ters puanlama yalnız skala sorularında kullanılabilir. Puan anahtarı tüm seçenekleri kapsamalı ve en az iki farklı puan içermelidir.

## Uygun kullanım (ISO 10667 ve ITC)

ISO 10667-1/-2:2020 ve ITC Test Kullanım Yönergeleri (2013) ile ITC Test Çeviri ve Uyarlama Yönergeleri (2017) ilkelerine göre:

1. **Amaç ve bilgilendirme:** Değerlendirmenin amacı, verinin kimlerle paylaşılacağı ve saklama süresi personele açıklanır. Portaldaki KVKK ve AI rızası bu akışın parçasıdır. AI analizi İK onayından sonra yapılır; otomatik karar verilmez.
2. **Uyarlama ve doğrulama:** Kullanıma almadan önce her rol için pilot uygulama yapılmalıdır (rol başına en az 100–200 kişi). Yapılacak analizler:
   - madde analizi (madde–toplam korelasyonu);
   - boyut başına güvenirlik (Cronbach α / McDonald ω);
   - doğrulayıcı faktör analizi;
   - gruplar arası madde yanlılığı (DIF): cinsiyet, yaş, vardiya, eğitim.

   SJT anahtarları kurum içi uzman paneliyle (usta, şef, İSG uzmanı) gözden geçirilmelidir.
3. **Adalet:**
   - Sorular yaş, cinsiyet, sağlık, din ya da aile durumunu sorgulamaz.
   - Mesai dışı eğitim gibi bakım yükümlülüğü olanları dezavantajlı kılabilecek seçenekler kullanılmadı.
   - Forklift sorusu kullanmayanlar için yönerge içerir.
   - Okuma güçlüğü olan personele soru okunarak destek verilebilir.
4. **Klinik değildir:** Duygusal denge maddeleri normal kişilik aralığını ölçer. Sistem tanı koymaz ve klinik değerlendirme yerine kullanılamaz.
5. **Geçerlilik beklentisi:** Schmidt ve Hunter'ın (1998) tahminleri Sackett, Zhang, Berry ve Lievens (2022) tarafından aşağı yönlü düzeltildi. Güncel bulgulara göre de yapılandırılmış görüşme, iş bilgisi ve iş örneği soruları en geçerli yöntemler arasındadır; kişilik ölçümü tek başına zayıftır. Şablonlar bu yüzden birden çok yöntemi birleştirir.

## Kaynakça

- Bartram, D. (2005). The Great Eight competencies: A criterion-centric approach to validation. *Journal of Applied Psychology, 90*(6), 1185–1203.
- Campion, M. A., Palmer, D. K., & Campion, J. E. (1997). A review of structure in the selection interview. *Personnel Psychology, 50*(3), 655–702.
- Goldberg, L. R. (1999). A broad-bandwidth, public domain, personality inventory. In *Personality Psychology in Europe* (Vol. 7, pp. 7–28).
- Goldberg, L. R., et al. (2006). The International Personality Item Pool and the future of public-domain personality measures. *Journal of Research in Personality, 40*(1), 84–96.
- Griffin, M. A., & Neal, A. (2000). Perceptions of safety at work. *Journal of Occupational Health Psychology, 5*(3), 347–358.
- International Test Commission (2013). *ITC Guidelines on Test Use* (v1.2); (2017) *ITC Guidelines for Translating and Adapting Tests* (2nd ed.).
- ISO 10667-1:2020 / ISO 10667-2:2020. *Assessment service delivery — Procedures and methods to assess people in work and organizational settings.*
- Janz, T. (1982). Initial comparisons of patterned behavior description interviews versus unstructured interviews. *Journal of Applied Psychology, 67*(5), 577–580.
- McClelland, D. C. (1998). Identifying competencies with behavioral-event interviews. *Psychological Science, 9*(5), 331–339.
- McDaniel, M. A., et al. (2001). Use of situational judgment tests to predict job performance. *Journal of Applied Psychology, 86*(4), 730–740.
- McDaniel, M. A., Hartman, N. S., Whetzel, D. L., & Grubb, W. L. (2007). Situational judgment tests, response instructions, and validity. *Personnel Psychology, 60*(1), 63–91.
- Motowidlo, S. J., Dunnette, M. D., & Carter, G. W. (1990). An alternative selection procedure: The low-fidelity simulation. *Journal of Applied Psychology, 75*(6), 640–647.
- Nakajima, S. (1988). *Introduction to TPM.* Productivity Press.
- Neal, A., & Griffin, M. A. (2006). A study of the lagged relationships among safety climate, safety motivation, safety behavior, and accidents. *Journal of Applied Psychology, 91*(4), 946–953.
- O*NET OnLine, USDOL/ETA — 51-9161.00, 53-7065.00, 43-5071.00, 53-7051.00, 49-9041.00, 11-3051.00, 17-2112.00 (CC BY 4.0).
- Sackett, P. R., Zhang, C., Berry, C. M., & Lievens, F. (2022). Revisiting meta-analytic estimates of validity in personnel selection. *Journal of Applied Psychology, 107*(11), 2040–2068.
- Schmidt, F. L., & Hunter, J. E. (1998). The validity and utility of selection methods in personnel psychology. *Psychological Bulletin, 124*(2), 262–274.
- Shaffer, J. A., & Postlethwaite, B. E. (2012). A matter of context: A meta-analytic investigation of the relative validity of contextualized and noncontextualized personality measures. *Personnel Psychology, 65*(3), 445–494.
- Weekley, J. A., & Ployhart, R. E. (Eds.). (2006). *Situational Judgment Tests: Theory, Measurement, and Application.* Erlbaum.
- Zohar, D. (1980). Safety climate in industrial organizations. *Journal of Applied Psychology, 65*(1), 96–102.
- Zohar, D., & Luria, G. (2005). A multilevel model of safety climate. *Journal of Applied Psychology, 90*(4), 616–628.
