import { createMiddleware } from "@tanstack/react-start";

export const attachFirebaseAuth = createMiddleware().server(async ({ next, context }) => {
  // Firebase auth is primarily client-side
  // We'll handle auth context from client-side session
  const request = context.request as Request;
  const authHeader = request.headers.get("authorization");
  
  let user = null;
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      // In a real implementation, you'd verify the ID token here
      // For now, we'll extract user info from the token
      const token = authHeader.substring(7);
      // Note: In production, use admin SDK to verify token
      // const decodedToken = await admin.auth().verifyIdToken(token);
      // user = { id: decodedToken.uid, email: decodedToken.email };
      
      // For development, we'll parse basic info
      const payload = JSON.parse(atob(token.split('.')[1]));
      user = {
        id: payload.user_id || payload.sub,
        email: payload.email,
      };
    } catch (error) {
      console.error("Auth verification error:", error);
    }
  }
  
  return next({
    context: {
      ...context,
      user,
    },
  });
});
