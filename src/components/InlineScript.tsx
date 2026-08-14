/**
 * A script that runs while the browser is still parsing the document.
 *
 * React warns when a component renders a `<script>` tag, because a script
 * inserted through the DOM never executes — so on the client the tag is marked
 * `text/plain` and is inert, and only the server's copy, which the browser
 * parses out of the HTML itself, is a real script. `suppressHydrationWarning`
 * covers the difference in `type` between the two.
 *
 * This is the shape the Next.js guide on preventing flash before hydration
 * gives; see node_modules/next/dist/docs/01-app/02-guides.
 */
export function InlineScript({ children }: { children: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: children }}
    />
  );
}
