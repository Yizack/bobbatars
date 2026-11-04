import type { H3Event } from "h3";

export default defineOAuthTwitchEventHandler({
  config: {
    scope: ["user:read:email"]
  },
  async onSuccess (event, { user }) {
    await setUserSession(event, {
      user: {
        id: user.id,
        login: user.login,
        displayName: user.display_name
      }
    });

    const existingUser = await db.select().from(tables.users).where(
      eq(tables.users.twitchId, user.id)
    ).get();

    if (!existingUser) {
      await db.insert(tables.users).values({
        twitchId: user.id,
        twitchLogin: user.login,
        twitchDisplay: user.display_name
      }).run();
    }
    else {
      await db.update(tables.users).set({
        twitchLogin: user.login,
        twitchDisplay: user.display_name
      }).where(
        eq(tables.users.twitchId, user.id)
      ).run();
    }

    return send(event as unknown as H3Event, `
      <script>
        localStorage.removeItem('temp-nuxt-auth-utils-popup');
        window.close();
      </script>
    `, "text/html");
  }
});
