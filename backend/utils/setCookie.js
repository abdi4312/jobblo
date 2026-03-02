export const setCookie = (res, token) => {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Agar production (AWS) par domain alag hain (CORS), toh "none" use karein, warna "lax"
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", 
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Days
  };

  res.cookie("token", token, options);
};