import type { Prisma, PrismaClient } from "@prisma/client";
import { AI_NOT_CONNECTED_REASON } from "../src/lib/ai-connection.js";
import { computeScaleScores } from "../src/services/scoring.service.js";

/**
 * 2026 Q1 Potansiyel Haritası'nın 30 sorusunun tamamını birbirinden farklı biçimde
 * cevaplamış üç örnek personel. Cevaplar soru setindeki sıraya göredir; SCALE sorusu sayıdır.
 * AI analizi üretilmez: entegrasyon bağlanınca İK panelden analizi başlatır.
 */
interface Respondent {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  experienceYear: number;
  shift: "MORNING" | "AFTERNOON" | "NIGHT";
  dept: string;
  team: string;
  hireDate: string;
  /** Tamamlanma zamanı: seed anından bu kadar gün önce */
  completedDaysAgo: number;
  answers: (string | number)[];
}

export const RESPONDENTS: Respondent[] = [
  {
    employeeId: "P006",
    firstName: "Emre",
    lastName: "Aydın",
    email: "emre.aydin@example.com",
    position: "CNC Operatörü",
    experienceYear: 7,
    shift: "MORNING",
    dept: "Üretim",
    team: "CNC Ekibi A",
    hireDate: "2019-03-04",
    completedDaysAgo: 4,
    answers: [
      "Önce makineyi güvenli duruma alır, alarm kodunu ve hatanın hangi satırda çıktığını not ederim. Programı simülasyonda tekrar çalıştırıp hatanın programdan mı, takım ofsetinden mi yoksa bağlamadan mı kaynaklandığını ayırırım. Son değişiklik yapılan bloklara bakarım; koordinat sistemi (G54/G55) ve takım telafisi en sık karşılaştığım nedenler. Düzeltmeden sonra ilk parçayı tek blok modunda, düşük ilerlemeyle işler, ölçtürür ve yaşananı vardiya defterine yazarım ki bir sonraki arkadaş aynı hataya düşmesin.",
      "Önce sapmanın yönünü ve düzenini görmek için son 20-30 parçanın ölçümlerini sırayla tabloya dökerim. Sapma sabitse ofset ya da sıfırlama hatası, giderek artıyorsa takım aşınması veya ısıl genleşme olabilir. Takımı, bağlama aparatını ve tezgahın ısınma süresini tek tek kontrol ederim; her seferinde yalnızca bir değişkeni değiştiririm. Kök nedeni kalite ekibiyle 5 Neden yöntemiyle netleştirip kalıcı önlemi talimata eklerim.",
      "Takım değişim sürelerini kısaltmak için önceden ölçülmüş takımlarla hazır bir takım arabası (SMED) öneririm. Sık işlenen parçalar için standart bağlama aparatları ve ilk parça onay kontrol listesi hazırlanabilir. Geçen yıl ekipte takım ömrünü kayıt altına almaya başladık; kırılmadan önce değiştirerek duruşları ciddi azalttık. Vardiya devirlerinde 5 dakikalık kısa bir devir teslim görüşmesi de bilgi kaybını önler.",
      "Önce tamamını baştan sona bir kez okur, ayrıntıya girmeden genel amacı anlamaya çalışırım. Sonra adımlara bölüp kritik toleransları ve güvenlik notlarını işaretlerim. Anlamadığım bir nokta varsa işe başlamadan teknoloğa ya da mühendise sorarım; varsayımla iş yapmayı sevmem.",
      "Vardiya başında iş emirlerini öncelik ve teslim tarihine göre sıralarım. Takım ve malzeme hazırlığını tezgah çalışırken yaparım ki bekleme olmasın. Gün içinde kısa notlar alır, vardiya sonunda yarım kalan işleri ve dikkat edilmesi gerekenleri devir defterine yazarım.",
      "İnce cidarlı alüminyum bir gövde parçasında titreşim yüzünden yüzey pürüzlülüğü sürekli tolerans dışına çıkıyordu. Devir ve ilerlemeyi değiştirmek yetmedi. Bağlamayı yeniden tasarlayıp parçayı içeriden destekleyen bir aparat yaptırdık, takım yolunu da trokoidal frezeye çevirdim. Hurda oranı yüzde 12'den yüzde 2'nin altına indi ve bu yöntem benzer parçalarda standart oldu.",
      "Önce iki tarafı ayrı ayrı dinlerim; kimin haklı olduğundan çok sorunun ne olduğuna odaklanırım. Anlaşmazlıklar genelde iş paylaşımından ya da bilgi eksikliğinden çıkıyor. Ortak bir çözüm önerip ikisinin de kabul etmesini sağlamaya çalışırım; çözülmezse vardiya amirine birlikte gideriz, arkadan konuşulmasına izin vermem.",
      "Önce kendim bir kez yaparak gösteririm, sonra onun yapmasını izlerim. Sadece düğmelere basmayı değil, neden öyle yaptığımızı da anlatırım. Kritik noktaları basit bir kontrol listesine yazıp veririm ve ilk hafta her gün kısa bir soru-cevap yaparız. Sormanın ayıp olmadığını, hatadan korkmamasını özellikle söylerim.",
      "Gece vardiyasında soğutma sıvısı konsantrasyonunun düştüğünü ve takım ömrünün kısaldığını fark ettim. Sabahı beklemek yerine refraktometreyle ölçüp doğru oranı ayarladım ve bu ölçümün haftalık kontrol listesine eklenmesini önerdim. Öneri kabul edildi, artık her pazartesi ölçülüyor.",
      "Evet, istiyorum. Yedi yıldır sahadayım; tezgahları, ekibi ve süreci iyi tanıyorum. Ekip arkadaşlarım zaten sorun olduğunda bana geliyor. Amir olarak hem üretim hedeflerini tutturmak hem de yeni arkadaşların daha hızlı yetişmesini sağlamak isterim. Bunun için liderlik ve planlama eğitimi almaya da hazırım.",
      "Önce yargılamadan sebebini anlamaya çalışırım; bazen bilgi eksikliği, bazen özel bir sorun oluyor. Birebir konuşur, nerede zorlandığını sorarım. Küçük ve somut hedefler koyup bir süre yanında çalışırım. Gelişme olmazsa durumu amirle paylaşırım ama önce destek olmak benim için önemli.",
      "Zor bir problemi çözüp tezgahın sorunsuz aktığını görmek. Yetiştirdiğim birinin kendi başına iş çıkarabilmesi de beni çok mutlu ediyor. Emeğimin görülmesi ve gelişme imkânı da önemli.",
      "Planlamadan bir arkadaş acil bir siparişi hemen tezgaha almamızı istiyordu ama o sırada başka acil bir iş çalışıyordu ve tartışma sertleşti. Sakin kalıp iki işin teslim tarihlerini ve tezgah kapasitesini masaya koydum. Sıralamayı amire danışarak birlikte netleştirdik. Sonrasında planlamayla haftalık kısa bir toplantı önerdim, bu tür sürtüşmeler azaldı.",
      "Önce onun nasıl çalışmayı sevdiğini gözlemlerim; bazıları her şeyi yazılı ister, bazıları konuşarak anlaşır. Ortak noktayı iş sonucunda buluruz: kalite ve teslim tarihi. Görev paylaşımı net olursa tarz farkı sorun olmuyor, hatta birbirimizin eksiğini tamamlıyoruz.",
      "İlk anda tepki vermem, önce dinlerim. Sonra uygun bir zamanda sakin bir şekilde verilerle durumu anlatırım. Eleştirinin haklı bir tarafı varsa onu da kabul ederim. Amacım kimin haklı olduğu değil, sorunun tekrarlanmaması.",
      "Söz verdiğim işi zamanında yaparak. Bilmediğim bir şeyi biliyormuş gibi davranmam, hata yaptığımda saklamam. Biri size bir sorun anlattığında suçlu aramadan çözüme odaklanırsanız güven kendiliğinden oluşuyor.",
      "Uygun bir anda yanına gidip iyi olup olmadığını sorarım, zorlamam. İş yükünü hafifletebileceğim bir şey varsa yardım ederim, örneğin ölçümlerini ben yaparım. Gerekirse işin aksamaması için amire haber veririm ama özel konusunu başkasıyla paylaşmam.",
      "Açık ve net konuşurum. Teknik konuları ayrıntılı anlatırım ama karşımdakinin seviyesine göre sadeleştiririm. Dinlemeye de önem veririm; özellikle yeni arkadaşlar bir şeyi anlamadığında bunu rahatça söyleyebilsin isterim.",
      "CAM programında 5 eksen işleme ve takım yolu optimizasyonu öğrendim. Kendi isteğimle hafta sonu kursuna katıldım, sonra öğrendiklerimi ekipteki iki arkadaşa da gösterdim. Ayrıca istatistiksel proses kontrol (SPC) grafiklerini okumayı öğrendim.",
      "Hatayı hemen bildiririm, saklamak daha büyük sorun yaratır. Sonra neden olduğunu anlamaya çalışır, tekrar olmaması için neyi değiştirmem gerektiğine bakarım. Hata yapınca canım sıkılır ama bunu bir öğrenme fırsatı olarak görürüm.",
      "Yeni gelen yatay işleme merkezini öğrenirken önce kullanım kılavuzunu ve kumanda ekranını inceledim. Üreticinin teknisyeni kurulum yaparken yanından ayrılmadım, her adımı not aldım. Sonra basit parçalarla deneme yapıp zorluğu adım adım artırdım. İki hafta içinde ekip için kısa bir kullanım özeti hazırladım.",
      "Bir ekibi yöneten üretim ya da vardiya sorumlusu olmak istiyorum. Uzun vadede üretim planlama veya süreç iyileştirme tarafında da çalışmak isterim. Bunun için yalın üretim ve liderlik eğitimlerine devam etmeyi planlıyorum.",
      "Online kurslar takip ediyorum, şu an CAM ve yalın üretim üzerine. Yeni gelen makinelerde gönüllü olarak ilk öğrenen olmaya çalışıyorum. Deneyimli ustalara da sürekli soru soruyorum; onların tecrübesi kitaplardan daha değerli.",
      "Pandemi döneminde vardiyalar yarıya inmişti ve iş yükü çok artmıştı; ekipte morali düşük olanlar vardı. Kendi işimi düzenledim, eksik kalan işleri paylaşmak için arkadaşlarla küçük bir plan yaptık. Zor bir dönemdi ama birlikte hareket ettiğimiz için hedeflerden çok uzaklaşmadık. Bana organizasyonun ne kadar önemli olduğunu öğretti.",
      "Somut bir şey üretmek ve sonucunu hemen görmek. Hata payının az olduğu, disiplin gerektiren bir ortam bana uygun. Ekip çalışması ve sürekli iyileştirme fırsatları da hoşuma gidiyor.",
      8,
      "Problem çözme ve süreç iyileştirme gerektiren işlerde. Yeni bir parçanın ilk kurulumunu yapmak, programı optimize etmek ya da bir arızanın kök nedenini bulmak beni en verimli yapan görevler.",
      "Kalite. Hızlı üretip hurda çıkarırsanız aslında hiç hız kazanmamış olursunuz. Ama ikisi birbirine rakip değil; doğru süreçle kaliteyi sağladıktan sonra hızı artırmak mümkün. Önce kaliteyi garanti eder, sonra çevrim süresini iyileştiririm.",
      "Ekip yönetimi ve yeni personelin eğitimi konusunda. Ayrıca hurda azaltma ve takım ömrü gibi iyileştirme projelerinde sorumluluk almak isterim.",
      "Zor bir parçayı ilk denemede tolerans içinde çıkarmak. Bir de bir arkadaşa bir şey öğretip onun başardığını görmek.",
    ],
  },
  {
    employeeId: "P007",
    firstName: "Zeynep",
    lastName: "Arslan",
    email: "zeynep.arslan@example.com",
    position: "Kalite Kontrol Teknisyeni",
    experienceYear: 3,
    shift: "AFTERNOON",
    dept: "Kalite",
    team: "Ölçüm Ekibi",
    hireDate: "2023-01-16",
    completedDaysAgo: 2,
    answers: [
      "CNC programlama konusunda çok deneyimli değilim, kalite tarafındayım. Böyle bir durumda önce alarmı ve hatayı not eder, operatör arkadaşla birlikte hangi adımda çıktığına bakarım. Parçayı ölçerek hatanın ölçüye etkisini belirler, programcıya ya da teknoloğa somut verilerle iletirim. Çözümden sonra ilk parçanın ölçümünü yapıp onay veririm.",
      "Ölçüm verilerini toplayıp grafik halinde görmek isterim: sapma sürekli mi, yoksa belirli bir saatten sonra mı başlıyor? Ölçüm cihazının kalibrasyonunu ve ölçüm yöntemimi de kontrol ederim, çünkü bazen sorun ölçümde olabiliyor. Sonra operatör ve bakımla oturup olası nedenleri sıralarız. Ben daha çok veriyi düzenleyip herkesin aynı şeyi görmesini sağlamaya çalışırım.",
      "Ölçüm sonuçlarının operatöre daha hızlı ulaşması için tezgah başında basit bir ölçüm takip formu önerirdim; böylece sapma büyümeden fark edilir. Kalite ile üretim arasında vardiya başında kısa bir bilgi paylaşımı yapılması da iletişim kopukluklarını azaltır.",
      "Önce sakince okuyup anladıklarımla anlamadıklarımı ayırırım. Anlamadığım kısımları deneyimli bir arkadaşa sorarım. Bazen kendim için küçük bir özet ya da şema çıkarırım, öyle daha iyi akılda kalıyor.",
      "Gün başında ölçülecek parçaların listesini çıkarır, acil olanları öne alırım. Renkli etiketlerle hangi parçanın beklemede, hangisinin onaylı olduğunu ayırıyorum. Ama gün içinde çok fazla acil iş gelince planım bozulabiliyor; bunu daha iyi yönetmeyi öğrenmeye çalışıyorum.",
      "Bir müşteri iadesinde parçanın neden reddedildiğini bulmamız gerekiyordu; bizim ölçümlerimizde parça uygundu. Müşterinin ölçüm yöntemini sorunca farklı bir referans yüzey kullandıklarını fark ettim. Müşteri ve mühendisimizle görüşüp ortak bir ölçüm talimatı hazırladık. Teknik olarak çok karmaşık değildi ama iletişimle çözüldü.",
      "Genelde arabulucu olurum. İki tarafı da dinler, birbirlerini anlamalarına yardımcı olmaya çalışırım; çoğu zaman sorun yanlış anlaşılmadan çıkıyor. Ortamın gerginleşmesinden hoşlanmam, o yüzden ortamı yumuşatmaya çalışırım.",
      "Sabırla, adım adım ve örneklerle anlatırım. Önce neden önemli olduğunu açıklar, sonra birlikte yaparız. Anlattıktan sonra ona tekrar anlattırırım, böylece gerçekten anlayıp anlamadığını görürüm. Ölçüm cihazlarını öğretirken küçük bir pratik kart hazırlamıştım, çok işe yaradı.",
      "Yeni başlayan arkadaşların ölçüm cihazlarını yanlış kullandığını gördüm. Kimse istemeden kısa bir eğitim notu hazırladım ve öğle aralarında birkaç kez uygulamalı gösterdim. Sonrasında ölçüm hatası yüzünden yapılan tekrar ölçümler azaldı.",
      "Şu an için emin değilim. İnsanlarla çalışmayı seviyorum ama vardiya amirliğinin üretim baskısı bana uygun olmayabilir. Kendimi daha çok eğitim veren ya da kalitede uzmanlaşan bir rolde görüyorum. Deneyimim arttıkça ileride düşünebilirim.",
      "Önce onunla yalnız konuşup neler yaşadığını anlamaya çalışırım; belki motivasyonu düşüktür, belki bir şeyi bilmiyordur. Destek olabileceğim bir şey varsa yardım ederim. Ama açık konuşmakta zorlanabilirim, kırıcı olmaktan çekinirim.",
      "Bir şey öğrenmek ve öğrendiğimi başkalarıyla paylaşmak. Ekipte iyi bir atmosfer olması ve yaptığım işin bir anlamı olduğunu hissetmek beni motive ediyor.",
      "Bir operatör arkadaş, parçasını reddettiğim için bana çok sinirlenmişti. Sesimi yükseltmeden ölçüm sonuçlarını birlikte inceledik; neden reddedildiğini görünce sakinleşti. Sonra bir sonraki parçada nelere dikkat edebileceğini anlattım. Şimdi daha iyi anlaşıyoruz.",
      "Onun tarzını anlamaya çalışır, kendimi biraz ona göre ayarlarım. Örneğin kısa ve net bilgi isteyen biriyse uzun açıklamalar yapmam. Esnek olmaya çalışırım ama bazen fazla uyum sağlayıp kendi fikrimi geri planda bırakabiliyorum.",
      "İlk anda üzülürüm ve bunu belli edebilirim. Ama sonra sakinleşip durumu anlatmaya çalışırım; karşımdakinin neden öyle düşündüğünü anlamak benim için önemli. Kişisel algılamamaya çalışıyorum, her zaman başaramasam da.",
      "İnsanları dinleyerek ve onlara gerçekten ilgi göstererek. Sözümü tutmaya özen gösteririm. Herkese eşit davranmaya çalışırım, kimseyi kayırmam.",
      "Hemen yanına gider, iyi olup olmadığını sorarım. Konuşmak isterse dinlerim, istemezse bir çay getiririm. İşlerinden bazılarını üstlenebilirim. Zor anlarında insanların yalnız hissetmemesi bence çok önemli.",
      "Sıcak ve anlaşılır. İnsanlarla kolay iletişim kurar, dinlemeyi severim. Bazen fazla ayrıntıya girdiğimi söylüyorlar, kısa ve öz olmaya çalışıyorum.",
      "Üç boyutlu ölçüm makinesinin (CMM) temel kullanımını öğrendim. Kendi isteğimle online bir istatistik kursuna da başladım. Sunum becerimin de geliştiğini düşünüyorum, kalite toplantılarında artık daha rahat konuşuyorum.",
      "Önce kendime kızarım ama sonra hatayı sahiplenirim. Amirime söyler, nasıl düzelteceğimizi konuşuruz. Aynı hatayı tekrar yapmamak için kendime notlar alırım.",
      "CMM'yi öğrenirken önce kıdemli bir arkadaşın yanında izledim, sonra onun gözetiminde basit parçalarla denedim. Kullanım kılavuzundan özet çıkardım ve video eğitimlerle tamamladım. Öğrenirken çok soru sordum, sormaktan çekinmem.",
      "Kalite mühendisi ya da kurum içi eğitmen olmak istiyorum. Bunun için açıktan üniversite okumayı düşünüyorum. İnsanlara bir şey öğretmek ve kaliteyi geliştirmek beni gerçekten mutlu ediyor.",
      "Özellikle istatistik ve kalite yönetimi üzerine online kurslara katılıyorum, kitap okuyorum. Kurum içi eğitimlere gönüllü katılıyorum, fırsat çıktığında kendim de anlatıyorum.",
      "Ailemde bir hastalık sürecinde hem işe hem eve yetişmeye çalıştım. O dönemde amirimle açıkça konuştum, vardiya düzenimi biraz değiştirdik; ekip arkadaşlarım da çok destek oldu. Yardım istemenin zayıflık olmadığını o dönemde öğrendim.",
      "Ekip çalışması ve herkesin birbirine bağlı olması. Kalite olarak üretimin her aşamasına dokunuyoruz, bu çok hoşuma gidiyor. Gürültü ve tempo zaman zaman yorucu olsa da insanlar burada samimi.",
      5,
      "Ölçüm, analiz ve eğitim gibi dikkat ve iletişim gerektiren görevlerde. Sakin bir ortamda ayrıntılı çalışırken çok verimli oluyorum; çok hızlı ve baskılı işlerde daha çabuk yoruluyorum.",
      "Kalite, tabii ki. Hatalı bir parça müşteriye giderse hem güven kaybı hem de maliyet çok daha büyük olur. Ama hızın da önemli olduğunu biliyorum, o yüzden kaliteyi hızlı sağlamanın yollarını aramak gerekiyor.",
      "Yeni personelin kalite ve ölçüm eğitimlerinde. Müşteri şikâyetlerinin incelenmesinde de daha fazla rol almak isterim.",
      "Bir şeyi birine öğrettiğim ve onun başardığını gördüğüm anlar. Ölçümle bir sorunun kaynağını bulmak da çok keyifli.",
    ],
  },
  {
    employeeId: "P008",
    firstName: "Burak",
    lastName: "Koç",
    email: "burak.koc@example.com",
    position: "Tezgah Operatörü",
    experienceYear: 1,
    shift: "NIGHT",
    dept: "Üretim",
    team: "CNC Ekibi B",
    hireDate: "2025-09-01",
    completedDaysAgo: 1,
    answers: [
      "Ustabaşına haber veririm, o bakar genelde.",
      "Ölçüyü ayarlarım, olmazsa kaliteciye söylerim.",
      "Bilmiyorum, her şey zaten belli. Belki malzeme daha hızlı gelse.",
      "Ne yapmam gerektiğini birine sorarım, uzun talimatları okumak sıkıcı.",
      "Bana ne verilirse onu yapıyorum. Biri bitince öbürüne geçiyorum.",
      "Bir kere tezgah alarm verdi, resetledim düzeldi. Çok zorlu bir şey yaşamadım henüz.",
      "Karışmam. Herkes kendi işini yapsın.",
      "Bana nasıl gösterdilerse öyle gösteririm. Yaparak öğrenir.",
      "Hatırlamıyorum öyle bir şey.",
      "Hayır. Sorumluluk fazla, maaş farkı da çok değil.",
      "Bu benim işim değil, amir ilgilensin.",
      "Maaş ve mesai. İşin erken bitmesi.",
      "Bir arkadaş sürekli işime karışıyordu, bir şey demedim, görmezden geldim.",
      "Ben kendi işimi yapıyorum, o da kendininkini. Sorun olmuyor.",
      "Sinirlenirim ama bir şey demem. Sonra unuturum.",
      "Bilmiyorum, düzgün çalışırsan güvenirler herhalde.",
      "Moralin mi bozuk derim. Ama çok karışmam.",
      "Az konuşurum. Gerektiği kadar.",
      "Tezgahta parça bağlamayı öğrendim.",
      "Bazen söylemiyorum, düzeltip devam ediyorum. Büyük bir şeyse söylerim.",
      "Ustam gösterdi, ben de izledim. Birkaç kere yapınca öğrendim.",
      "Bilmiyorum, belki başka bir işte. Daha iyi maaş veren bir yerde.",
      "Şu an bir şey yapmıyorum. Vakit olmuyor.",
      "Askerlik zordu, bitti geçti.",
      "Mesai saatleri belli, o iyi.",
      3,
      "Tekrar eden, basit işlerde. Parça takıp çıkarmak gibi.",
      "Hız. Hedef tutmazsa sorun oluyor.",
      "Şimdilik istemiyorum, kendi işim yeterli.",
      "Mola saatleri ve iş bitince eve gitmek.",
    ],
  },
];

/** Cevap süresi: okuma + yazma; kısa cevap kısa sürer */
function answerDurationSec(answer: string | number) {
  return typeof answer === "number" ? 15 : Math.round(20 + answer.length * 0.35);
}

export async function seedRespondents(params: {
  prisma: PrismaClient;
  organizationId: string;
  assessmentId: string;
  questionSetId: string;
  departments: Record<string, string>;
  teams: Record<string, string>;
  portalPasswordHash: string;
  now: Date;
}) {
  const { prisma, organizationId, assessmentId, questionSetId, now } = params;

  const items = await prisma.questionSetItem.findMany({
    where: { questionSetId },
    orderBy: { order: "asc" },
    include: { question: true },
  });
  const questions = items.map((item) => ({ ...item.question, customWeight: item.customWeight }));

  for (const r of RESPONDENTS) {
    if (questions.length !== r.answers.length) {
      console.warn(`⚠️ ${r.employeeId}: soru seti ${questions.length} soru, cevap ${r.answers.length}; atlandı`);
      continue;
    }

    const personnel =
      (await prisma.personnel.findFirst({ where: { organizationId, employeeId: r.employeeId } })) ??
      (await prisma.personnel.create({
        data: {
          employeeId: r.employeeId,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          position: r.position,
          experienceYear: r.experienceYear,
          shift: r.shift,
          hireDate: new Date(r.hireDate),
          departmentId: params.departments[r.dept]!,
          teamId: params.teams[r.team]!,
          organizationId,
          portalPasswordHash: params.portalPasswordHash,
        },
      }));

    const existing = await prisma.assessmentSession.findUnique({
      where: { assessmentId_personnelId: { assessmentId, personnelId: personnel.id } },
      select: { id: true },
    });
    if (existing) continue; // Var olan oturum ve cevaplara dokunulmaz

    const durations = r.answers.map(answerDurationSec);
    const durationSec = durations.reduce((a, b) => a + b, 0);
    const completedAt = new Date(now.getTime() - r.completedDaysAgo * 86_400_000);
    const startedAt = new Date(completedAt.getTime() - durationSec * 1000);

    let elapsed = 0;
    const answers = questions.map((q, i) => {
      const value = r.answers[i]!;
      elapsed += durations[i]!;
      return {
        questionId: q.id,
        textAnswer: typeof value === "string" ? value : null,
        scaleValue: typeof value === "number" ? value : null,
        durationSec: durations[i]!,
        answeredAt: new Date(startedAt.getTime() + elapsed * 1000),
      };
    });

    const session = await prisma.assessmentSession.create({
      data: {
        assessmentId,
        personnelId: personnel.id,
        status: "COMPLETED",
        startedAt,
        completedAt,
        durationSec,
        dimensionScores: computeScaleScores(questions, answers) as Prisma.InputJsonValue,
        analysisPipeline: "NOT_QUEUED",
        analysisError: AI_NOT_CONNECTED_REASON,
        requiresHrReview: true,
        answers: { create: answers },
        consentRecords: {
          create: ["DATA_PROCESSING", "AI_ASSESSMENT"].map((consentType) => ({
            consentType,
            legalTextVersion: "1.0",
            accepted: true,
            acceptedAt: startedAt,
            personnelId: personnel.id,
          })),
        },
        sessionEvents: {
          create: [
            { type: "SESSION_STARTED", createdAt: startedAt },
            { type: "SESSION_COMPLETED", createdAt: completedAt, payload: { durationSec } },
          ],
        },
      },
    });
    console.log(`✅ Oturum (tamamlanan, ${answers.length} cevap): ${r.employeeId} ${r.firstName} ${r.lastName} → ${session.id}`);
  }
}
