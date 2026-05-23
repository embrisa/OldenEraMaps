import { BookOpenText, Compass, Download, ExternalLink, FileJson, Gamepad2, HardDrive, Monitor, PackageCheck, ShieldAlert } from "lucide-react";
import type { JSX } from "react";

const guideSections = [
  ["quick-start", "Quick Start"],
  ["where-to-buy", "Where to Buy"],
  ["windows", "Windows"],
  ["linux", "Linux"],
  ["steam-deck", "Steam Deck"],
  ["macos", "macOS"],
  ["verify", "Verify"]
] as const;

const storeLinks = [
  {
    title: "Steam",
    href: "https://store.steampowered.com/app/3105440/Heroes_of_Might_and_Magic_Olden_Era/",
    detail: "Best fit for Steam libraries, Steam Deck, Proton, Remote Play, Steam Cloud, and workshop-like Steam features when available."
  },
  {
    title: "Ubisoft Store",
    href: "https://store.ubisoft.com/us/heroes-of-might-and-magic--olden-era/6890dc81b38ea140dbdb7159.html",
    detail: "Best fit if you keep Ubisoft-published games in Ubisoft Connect or want to buy directly from Ubisoft."
  }
] as const;

const windowsLocations = [
  String.raw`C:\Program Files (x86)\Steam\steamapps\common\Heroes of Might and Magic Olden Era\HeroesOldenEra_Data\StreamingAssets\map_templates`,
  String.raw`D:\SteamLibrary\steamapps\common\Heroes of Might and Magic Olden Era\HeroesOldenEra_Data\StreamingAssets\map_templates`,
  String.raw`[Ubisoft Connect install folder]\Heroes of Might and Magic Olden Era\HeroesOldenEra_Data\StreamingAssets\map_templates`
] as const;

const linuxLocations = [
  "~/.local/share/Steam/steamapps/common/Heroes of Might and Magic Olden Era/HeroesOldenEra_Data/StreamingAssets/map_templates",
  "~/.steam/steam/steamapps/common/Heroes of Might and Magic Olden Era/HeroesOldenEra_Data/StreamingAssets/map_templates",
  "~/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/common/Heroes of Might and Magic Olden Era/HeroesOldenEra_Data/StreamingAssets/map_templates"
] as const;

function PathList({ paths }: { paths: readonly string[] }): JSX.Element {
  return (
    <ul className="install-path-list">
      {paths.map((path) => (
        <li key={path}><code>{path}</code></li>
      ))}
    </ul>
  );
}

export function InstallationGuidePage(): JSX.Element {
  return (
    <section className="reference-layout installation-layout" aria-label="Olden Era installation guide page">
      <aside className="reference-nav" aria-label="Installation guide sections">
        <strong><Compass size={16} />Guide</strong>
        {guideSections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </aside>

      <div className="reference-main installation-main">
        <section id="quick-start" className="reference-section reference-section--hero installation-hero">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><Download size={20} /></span>
            <div>
              <h1>Installation Guide</h1>
              <p>
                Install Olden Era, find the game&apos;s map template folder, then copy exported <code>.rmg.json</code> files into
                <code> map_templates</code>. The exact library root changes by launcher and operating system; the folder inside
                the game install stays the same.
              </p>
            </div>
          </div>
          <div className="installation-step-strip" aria-label="Installation steps">
            <div><strong>1</strong><span>Buy and install the game from an official store.</span></div>
            <div><strong>2</strong><span>Open the install location from Steam or Ubisoft Connect.</span></div>
            <div><strong>3</strong><span>Copy exported templates into the map template folder.</span></div>
            <div><strong>4</strong><span>Restart the game and select the template in Random Map setup.</span></div>
          </div>
        </section>

        <section id="where-to-buy" className="reference-section">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><Gamepad2 size={20} /></span>
            <div>
              <h2>Where to Buy and Install</h2>
              <p>
                Official store listings can change. Check the store page before buying, especially for supported operating
                systems, launcher requirements, regional availability, and Early Access notes.
              </p>
            </div>
          </div>
          <div className="installation-card-grid">
            {storeLinks.map((store) => (
              <a key={store.title} className="installation-store-card" href={store.href} rel="noreferrer">
                <strong>{store.title}<ExternalLink size={15} /></strong>
                <span>{store.detail}</span>
              </a>
            ))}
          </div>
          <div className="reference-callout">
            <strong>Current platform stance</strong>
            <span>
              The official listed requirement is Windows 10 64-bit or newer. Linux and Steam Deck players should treat the
              Steam version as a Proton compatibility setup. macOS does not have a native release listed, so use a Windows
              install or a compatibility layer only if you are comfortable troubleshooting it.
            </span>
          </div>
        </section>

        <section id="windows" className="reference-section">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><Monitor size={20} /></span>
            <div>
              <h2>Windows: Steam and Ubisoft Connect</h2>
              <p>
                On Windows, use the launcher to open the game&apos;s install folder instead of guessing the drive. Steam users
                can right-click the game, then choose Manage and Browse local files. Ubisoft Connect users can use the game
                properties or installation details to open the local folder.
              </p>
            </div>
          </div>
          <PathList paths={windowsLocations} />
          <div className="installation-command-grid">
            <div className="reference-callout">
              <strong>PowerShell check</strong>
              <code>{'Test-Path "${env:ProgramFiles(x86)}\\Steam\\steamapps\\common\\Heroes of Might and Magic Olden Era\\HeroesOldenEra_Data\\StreamingAssets\\map_templates"'}</code>
            </div>
            <div className="reference-callout">
              <strong>Custom Steam libraries</strong>
              <span>
                In Steam, open Settings, Storage, select the library drive, then browse the game files. Custom drives often
                use <code>SteamLibrary\steamapps\common</code>.
              </span>
            </div>
          </div>
        </section>

        <section id="linux" className="reference-section">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><HardDrive size={20} /></span>
            <div>
              <h2>Linux: Steam with Proton</h2>
              <p>
                Install through Steam, enable Steam Play or a Proton version if Steam asks for it, then locate the same
                <code> HeroesOldenEra_Data/StreamingAssets/map_templates</code> folder inside your Steam library. The most common
                library roots are below.
              </p>
            </div>
          </div>
          <PathList paths={linuxLocations} />
          <div className="reference-callout">
            <strong>Terminal search inside known Steam roots</strong>
            <code>{String.raw`find ~/.local/share/Steam ~/.steam/steam ~/.var/app/com.valvesoftware.Steam/.local/share/Steam -path '*HeroesOldenEra_Data/StreamingAssets/map_templates' -type d 2>/dev/null`}</code>
          </div>
        </section>

        <section id="steam-deck" className="reference-section">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><PackageCheck size={20} /></span>
            <div>
              <h2>Steam Deck</h2>
              <p>
                Use Desktop Mode for template files. Install the game from Steam, open Dolphin, then browse to the internal
                Steam library or your microSD library. The final folder is still
                <code> HeroesOldenEra_Data/StreamingAssets/map_templates</code>.
              </p>
            </div>
          </div>
          <dl className="reference-key-grid">
            <div className="reference-key-grid__row">
              <dt>Internal storage</dt>
              <dd><code>/home/deck/.local/share/Steam/steamapps/common/Heroes of Might and Magic Olden Era/</code></dd>
            </div>
            <div className="reference-key-grid__row">
              <dt>microSD storage</dt>
              <dd><code>/run/media/mmcblk0p1/steamapps/common/Heroes of Might and Magic Olden Era/</code></dd>
            </div>
            <div className="reference-key-grid__row">
              <dt>File transfer</dt>
              <dd>Download the exported template in Desktop Mode, then move it into <code>map_templates</code>.</dd>
            </div>
          </dl>
        </section>

        <section id="macos" className="reference-section">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><ShieldAlert size={20} /></span>
            <div>
              <h2>macOS</h2>
              <p>
                Olden Era does not list a native macOS version. The reliable path is to manage templates on a Windows or
                Linux/Steam Deck install. Intel Mac users may use Boot Camp Windows. Apple Silicon users can try a Windows
                compatibility layer, but folder locations and game support depend on that tool.
              </p>
            </div>
          </div>
          <div className="reference-callout">
            <strong>Practical recommendation</strong>
            <span>
              Export <code>.rmg.json</code> from this site on macOS, then copy the file to a supported Olden Era install.
              Avoid editing files inside a compatibility wrapper unless you know where that wrapper stores its virtual
              Windows drive.
            </span>
          </div>
        </section>

        <section id="verify" className="reference-section">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><FileJson size={20} /></span>
            <div>
              <h2>Verify the Template</h2>
              <p>
                A copied file should end in <code>.rmg.json</code> and sit directly inside <code>map_templates</code>, not inside
                a zip file or extra folder. Restart Olden Era after copying. If it does not appear, check the file extension,
                JSON validity, and whether you copied it into the active Steam or Ubisoft library.
              </p>
            </div>
          </div>
          <ul className="reference-explainer-list">
            <li><strong>Correct file:</strong> <code>My Template.rmg.json</code></li>
            <li><strong>Wrong file:</strong> <code>My Template.rmg.json.txt</code></li>
            <li><strong>Correct folder:</strong> <code>HeroesOldenEra_Data/StreamingAssets/map_templates</code></li>
            <li><strong>After copying:</strong> restart the game before checking the Random Map template list.</li>
          </ul>
          <div className="reference-callout">
            <strong>Restart required</strong>
            <span>
              Olden Era reads map templates when the game starts. If you copy, replace, or rename a <code>.rmg.json</code> file
              while the game is open, fully close and restart the game before checking the Random Map template list.
            </span>
          </div>
          <div className="reference-callout">
            <strong><BookOpenText size={15} /> Template compatibility</strong>
            <span>
              OldenEraMaps validates exported JSON shape, but final playability still needs in-game validation because the
              game&apos;s random map generator is the authority.
            </span>
          </div>
        </section>
      </div>
    </section>
  );
}
