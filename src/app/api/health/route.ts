// 클라이언트가 서버 상태를 ping 할 때 사용. 인증 불필요.
// middleware.ts 의 isPublic 매처에 등록되어 있어 비로그인 상태에서도 200.
export async function GET() {
  return Response.json({ ok: true, time: Date.now() });
}
