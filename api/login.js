export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (username === 'admin' && password === '1234') {
    return res.status(200).json({
      success: true,
      message: 'Giriş başarılı'
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Kullanıcı adı veya şifre hatalı'
  });
}
