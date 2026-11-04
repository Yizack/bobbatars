export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession();

  const isApp = to.path.includes("/dashboard");

  if (loggedIn.value && !isApp) return navigateTo("/dashboard", { replace: true });
  if (!loggedIn.value && isApp) return navigateTo("/", { replace: true });
});
