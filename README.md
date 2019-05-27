# Pocket Newsletter Generator Lambda

> Example Lambda to fetch all "newsletter" posts from Pocket.

See the lambda code at [./src/lambda/newsletter.js](./src/lambda/newsletter.js).

Run it at [https://pocket-newsletter-lambda.netlify.com/](https://pocket-newsletter-lambda.netlify.com/).

## Pocket Fetching logic

The bulk of the Pocket-specific logic is the `fetchBookmarks` function, it does the following:

- fetch from Pocket API using consumer key and access token
  - passes `state: 'all'` in order to get both archived and unarchived posts
  - uses `tag: 'newsletter'` to fetch posts tagged with `newsletter`
  - `detailType: 'complete'` means the API returns more complete data
- convert the response to a flat list of `{ title, url, excerpts, authors }` (all of those fields are strings)
- return the list

See the code
```js
async function fetchBookmarks(consumerKey, accessToken) {
	const res = await axios.post('https://getpocket.com/v3/get', {
		consumer_key: consumerKey,
		access_token: accessToken,
		tag: 'newsletter',
		state: 'all',
		detailType: 'complete'
	});
	const {list} = res.data;
	// List is a key-value timestamp->entry map
	const entries = Object.values(list);
	return entries.map(
		({
			given_title,
			given_url,
			resolved_url,
			resolved_title,
			excerpt,
			authors,
			rest
		}) => ({
			...rest,
			title: given_title || resolved_title,
			url: given_url || resolved_url,
			excerpt,
			authors: authors
				? Object.values(authors)
						.map(({name}) => name)
						.filter(Boolean)
						.join(',')
				: ''
		})
	);
}
```

## Lamdba validation and body-parsing

The lambda only supports POST with a body, hence:
```js
if (event.httpMethod !== 'POST') {
  return {
    statusCode: 404,
    body: 'Not Found'
  };
}

if (!event.body) {
  return {
    statusCode: 400,
    body: 'Bad Request'
  };
}
```

We support both URL-encoded form POST requests (done eg. when JS is disabled on the demo page) and JSON requests.

The body arrives either base64 encoded (if using a URL-encoded form body request) or not. This is denoted by the `isBase64Encoded` flag on the `event`.

Parsing a base64-encoded string in Node is done using `Buffer.from(event.body, 'base64').toString('utf-8)`.

To convert the body from URL-encoded form into an object, the following function is used, which works for POSTs with simple fields.
```js
function parseUrlEncoded(urlEncodedString) {
	const keyValuePairs = urlEncodedString.split('&');
	return keyValuePairs.reduce((acc, kvPairString) => {
		const [k, v] = kvPairString.split('=');
		acc[k] = v;
		return acc;
	}, {});
}
```

Here's the functionality in the lambda:

```js
const {
		pocket_consumer_key: pocketConsumerKey,
		pocket_access_token: pocketAccessToken
	} = event.isBase64Encoded
		? parseUrlEncoded(Buffer.from(event.body, 'base64').toString('utf-8'))
    : JSON.parse(event.body);
```

If the consumer key or access token are missing we send a 400:
```js
if (!pocketConsumerKey || !pocketAccessToken) {
  return {
    statusCode: 400,
    body: 'Bad Request'
  };
}
```

Finally we attempt to `fetchBookmarks` (that function's functionality has been broken down above).

If that fails on a request error (when axios fails, it has a `response` property on the error), we want to send back that response's information to the client hence, otherwise just 500 on error or 200 on success:
```js
try {
  const bookmarks = await fetchBookmarks(pocketConsumerKey, pocketAccessToken);

  return {
    statusCode: 200,
    body: JSON.stringify(bookmarks)
  };
} catch(e) {
  if (e.response) {
    return {
      statusCode: e.response.statusCode,
      body: `Error while connecting to Pocket API: ${e.response.statusText}`
    }
  }
  return {
    statusCode: 500,
    body: e.message
  }
}
```

## Sample response

```js
[
  {
    "title": "TechnicalDebt",
    "url": "https://martinfowler.com/bliki/TechnicalDebt.html",
    "excerpt": "Software systems are prone to the build up of cruft - deficiencies in internal quality that make it harder than it would ideally be to modify and extend the system further.",
    "authors": ""
  },
  {
    "title": "CannotMeasureProductivity",
    "url": "https://martinfowler.com/bliki/CannotMeasureProductivity.html",
    "excerpt": "We see so much emotional discussion about software process, design practices and the like. Many of these arguments are impossible to resolve because the software industry lacks the ability to measure some of the basic elements of the effectiveness of software development.",
    "authors": ""
  },
  {
    "title": "How SQLite Is Tested",
    "url": "https://www.sqlite.org/testing.html",
    "excerpt": "The reliability and robustness of SQLite is achieved in part by thorough and careful testing. As of version 3.23.0 (2018-04-02), the SQLite library consists of approximately 128.9 KSLOC of C code.",
    "authors": ""
  },
  {
    "title": "How FriendFeed uses MySQL to store schema-less data",
    "url": "https://backchannel.org/blog/friendfeed-schemaless-mysql",
    "excerpt": "We use MySQL for storing all of the data in FriendFeed. Our database has grown a lot as our user base has grown. We now store over 250 million entries and a bunch of other data, from comments and \"likes\" to friend lists.",
    "authors": ""
  },
  {
    "title": "jlevy/the-art-of-command-line: Master the command line, in one page",
    "url": "https://github.com/jlevy/the-art-of-command-line",
    "excerpt": "Note: I'm looking for a new (and potentially paid) lead author to help expand this to a more comprehensive Guide. While it's very popoular, it could be both deeper and more helpful.",
    "authors": ""
  },
  {
    "title": "Project Mezzanine: The Great Migration | Uber Engineering Blog",
    "url": "https://eng.uber.com/mezzanine-migration/",
    "excerpt": "What happens when you have to migrate hundreds of millions of rows of data and more than 100 services over several weeks while simultaneously keeping Uber running for millions of riders? This is the story of how dozens of engineers helped Uber move to Mezzanine in 2014.",
    "authors": "Rene Schmidt"
  },
  {
    "title": "8 Protips to Start Killing It When Dockerizing Node.js - NodeSource",
    "url": "https://nodesource.com/blog/8-protips-to-start-killing-it-when-dockerizing-node-js/",
    "excerpt": "Containers are the best way to deploy Node.js applications to production. Containers provide a wide variety of benefits, from having the same environment in production and development to streamlining deploys for speed and size.  Dockerizing your Node.",
    "authors": "Tierney Cyren"
  },
  {
    "title": "How and Why We Switched from Erlang to Python – Mixpanel Engineering",
    "url": "https://engineering.mixpanel.com/2011/08/05/how-and-why-we-switched-from-erlang-to-python/",
    "excerpt": "A core component of Mixpanel is the server that sits at http://api.mixpanel.com. This server is the entry point for all data that comes into the system – it’s hit every time an event is sent from a browser, phone, or backend server.",
    "authors": "mxpnl"
  },
  {
    "title": "Some Were Meant for C - kell17some-preprint.pdf",
    "url": "https://www.cs.kent.ac.uk/people/staff/srk21//research/papers/kell17some-preprint.pdf",
    "excerpt": "",
    "authors": ""
  },
  {
    "title": "API Gateways Are Going Through an Identity Crisis",
    "url": "http://blog.christianposta.com/microservices/api-gateways-are-going-through-an-identity-crisis/",
    "excerpt": "API Gateways are going through a bit of an identity crisis these days. Are they centralized, shared resources that facilitate the exposure and governance of APIs to external entities?",
    "authors": ""
  },
  {
    "title": "Understanding Database Sharding",
    "url": "https://www.digitalocean.com/community/tutorials/understanding-database-sharding",
    "excerpt": "Any application or website that sees significant growth will eventually need to scale in order to accommodate increases in traffic. For data-driven applications and websites, it's critical that scaling is done in a way that ensures the security and integrity of their data.",
    "authors": "Justin Ellingwood"
  },
  {
    "title": "Moving from Ruby to Rust",
    "url": "http://deliveroo.engineering/2019/02/14/moving-from-ruby-to-rust.html",
    "excerpt": "In the Logistics Algorithms team, we have a service, called Dispatcher, the main purpose of which is to offer an order to the rider, optimally.",
    "authors": "Andrii Dmytrenko"
  },
  {
    "title": "Getting to Know Python 3.7: Data Classes, async/await and More! | Heroku",
    "url": "https://blog.heroku.com/python37-dataclasses-async-await",
    "excerpt": "If you're like me, or like many other Python developers, you've probably lived (and maybe migrated) through a few version releases. Python 3.7(.",
    "authors": "Casey Faist"
  },
  {
    "title": "? What does Unsplash cost in 2019?",
    "url": "https://medium.com/p/f499620a14d0",
    "excerpt": "Since then, Unsplash has continued to grow tremendously, now powering more image use than the major image media incumbents, Shutterstock, Getty, and Adobe, combined.",
    "authors": "Luke Chesser"
  },
  {
    "title": "PHP in 2019 - stitcher.io",
    "url": "https://stitcher.io/blog/php-in-2019",
    "excerpt": "Do you remember the popular \"PHP: a fractal of bad design\" blog post? The first time I read it, I was working in a crappy place with lots of legacy PHP projects. This article got me wondering whether I should just quit and go do something entirely different than programming.",
    "authors": ""
  }
]
```

## Simplifications applied here

On my site, the lambda doesn't read the access token and consumer key from the request.

Instead it's a simple GET that reads the token and key from environment variables.

## Development setup

You should run `yarn` before starting.

The following scripts are available:

* `yarn start`: start the Lambda(s) and serving the static directory using [Netlify Dev](https://www.netlify.com/products/dev/) . **Important:** before `start`.
* `yarn build:tw`: build the full set of Tailwind CSS utilities (useful for development), make sure to check what your site looks will look like live using `yarn build:css`
* `yarn build`: run netlify-lambda build + Tailwind CSS production build (removes unused classes using PurgeCSS)
* `yarn build:css`: Tailwind CSS production build (removes unused classes using PurgeCSS)
* `yarn lint` and `yarn format`: runs XO, the "JavaScript linter with great defaults" (see [github.com/xojs/xo](https://github.com/xojs/xo#readme)) with or without the `--fix` flag respectively
