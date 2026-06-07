import { useEffect, useState } from "react";

export type AppPage = "builder" | "browse" | "reference" | "install" | "my-maps";

interface SeoMetadata {
  title: string;
  description: string;
  robots?: string;
  ogType?: string;
}

function ensureHeadMeta(name: string, content: string, attribute: "name" | "property" = "name"): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, name);
    document.head.append(tag);
  }
  tag.setAttribute("content", content);
}

function ensureCanonicalLink(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.append(link);
  }
  link.setAttribute("href", href);
}

function pageSeoMetadata(page: AppPage): SeoMetadata {
  if (page === "browse") {
    return {
      title: "Browse Community Maps | Olden Era Maps",
      description: "Browse public Heroes of Might and Magic: Olden Era map templates by size, players, tags, ratings, and downloads.",
      ogType: "website"
    };
  }

  if (page === "reference") {
    return {
      title: "RMG JSON Reference | Olden Era Maps",
      description: "Reference fields and terminology for Heroes of Might and Magic: Olden Era .rmg.json map templates.",
      ogType: "article"
    };
  }

  if (page === "install") {
    return {
      title: "Installation Guide | Olden Era Maps",
      description: "Install Heroes of Might and Magic: Olden Era map templates on Windows, Steam, Ubisoft Connect, Linux, Steam Deck, and macOS compatibility setups.",
      ogType: "article"
    };
  }

  if (page === "my-maps") {
    return {
      title: "My Maps | Olden Era Maps",
      description: "Manage your uploaded Olden Era map templates.",
      robots: "noindex,nofollow",
      ogType: "website"
    };
  }

  return {
    title: "Olden Era Maps | RMG Template Builder",
    description: "Build, export, browse, and share Heroes of Might and Magic: Olden Era map templates for the .rmg.json workflow.",
    ogType: "website"
  };
}

function syncSeoMetadata(page: AppPage): void {
  const metadata = pageSeoMetadata(page);
  const canonicalUrl = new URL(window.location.pathname || "/", window.location.origin).toString();

  document.title = metadata.title;
  ensureHeadMeta("description", metadata.description);
  ensureHeadMeta("robots", metadata.robots ?? "index,follow");
  ensureHeadMeta("og:title", metadata.title, "property");
  ensureHeadMeta("og:description", metadata.description, "property");
  ensureHeadMeta("og:type", metadata.ogType ?? "website", "property");
  ensureHeadMeta("og:url", canonicalUrl, "property");
  ensureCanonicalLink(canonicalUrl);
}

function readPageFromLocation(): AppPage {
  if (window.location.pathname === "/browse") return "browse";
  if (window.location.pathname === "/reference") return "reference";
  if (window.location.pathname === "/install") return "install";
  if (window.location.pathname === "/my-maps") return "my-maps";
  return "builder";
}

export function useAppRoute() {
  const [page, setPage] = useState<AppPage>(() => readPageFromLocation());

  useEffect(() => {
    function handlePopstate(): void {
      setPage(readPageFromLocation());
    }

    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, []);

  useEffect(() => {
    syncSeoMetadata(page);
  }, [page]);

  function navigate(nextPage: AppPage): void {
    const nextPath = nextPage === "browse"
      ? "/browse"
      : nextPage === "reference"
        ? "/reference"
        : nextPage === "install"
          ? "/install"
          : nextPage === "my-maps"
            ? "/my-maps"
            : "/";
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setPage(nextPage);
  }

  return {
    page,
    navigate
  };
}
