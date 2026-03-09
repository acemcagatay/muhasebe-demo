export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const body = req.body;

  const username =
    body.username ||
    body.kullaniciAdi ||
    body.user ||
    "";

  const password =
    body.password ||
    body.sifre ||
    body.pass ||
    "";

  if (username === "NoxxHouse" && password === "NoxxHouse3519*") {
    return res.status(200).json({
      success: true,
      message: "Giriş başarılı"
    });
  }

  return res.status(401).json({
    success: false,
    message: "Kullanıcı adı veya şifre yanlış"
  });
}
