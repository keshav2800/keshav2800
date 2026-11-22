import { readFile, writeFile } from "node:fs/promises";

const login = "keshav2800";
const ownOrgs = ["keshav2800", "msmindlabs-com", "openblendai", "product-co-pilot", "Sustabli", "IGTS-NSUT-ACCOUNT", "zkp-ids", "fed-fit"];
const maxMerged = 8;
const maxOpen = 5;
const minRepoStars = 3;
const readmePath = "README.md";
const start = "<!-- OPEN-SOURCE:START -->";
const end = "<!-- OPEN-SOURCE:END -->";

const token = process.env.GITHUB_TOKEN;
const headers = { Accept: "application/vnd.github+json", ...(token && { Authorization: `Bearer ${token}` }) };
const exclusions = ownOrgs.map((owner) => `-user:${owner}`).join(" ");

async function getJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function searchPullRequests(state) {
  const query = `author:${login} type:pr ${state} ${exclusions}`;
  const { items } = await getJson(
    `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=50`,
  );
  return items.map((item) => ({
    title: item.title.replaceAll("|", "\\|"),
    url: item.html_url,
    repo: item.repository_url.replace("https://api.github.com/repos/", ""),
  }));
}

const line = ({ title, url, repo }) => `- [${title}](${url}) · \`${repo}\``;

const [allMerged, allOpen] = await Promise.all([searchPullRequests("is:merged"), searchPullRequests("is:open")]);

const repos = [...new Set([...allMerged, ...allOpen].map(({ repo }) => repo))];
const stars = new Map(
  await Promise.all(
    repos.map(async (repo) => [repo, (await getJson(`https://api.github.com/repos/${repo}`)).stargazers_count]),
  ),
);
const notable = ({ repo }) => stars.get(repo) >= minRepoStars;
const merged = allMerged.filter(notable).slice(0, maxMerged);
const open = allOpen.filter(notable).slice(0, maxOpen);

const sections = [];
if (merged.length) sections.push(`**Merged**\n\n${merged.map(line).join("\n")}`);
if (open.length) sections.push(`**In review**\n\n${open.map(line).join("\n")}`);
const body = sections.join("\n\n") || "_First pull requests on their way._";

const readme = await readFile(readmePath, "utf8");
const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
await writeFile(readmePath, readme.replace(pattern, `${start}\n${body}\n${end}`));
