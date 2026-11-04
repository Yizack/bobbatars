import type { H3Event } from "h3";

export default defineOAuthTwitchEventHandler({
  config: {
    scope: ["user:read:email"]
  },
  async onSuccess (event, { user: _user }) {
    const user = await db.insert(tables.users).values({
      twitchId: _user.id,
      twitchLogin: _user.login,
      twitchDisplay: _user.display_name
    }).onConflictDoUpdate({
      target: tables.users.twitchId,
      set: {
        twitchLogin: _user.login,
        twitchDisplay: _user.display_name
      }
    }).returning().get();

    await setUserSession(event, {
      user: {
        id: user.id,
        twitchId: user.twitchId,
        twitchLogin: user.twitchLogin,
        twitchDisplay: user.twitchDisplay
      }
    });

    return send(event as unknown as H3Event, `
      <script>
        localStorage.removeItem('temp-nuxt-auth-utils-popup');
        window.close();
      </script>
    `, "text/html");
  }
});
