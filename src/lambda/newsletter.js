import axios from 'axios';

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

function parseUrlEncoded(urlEncodedString) {
	const keyValuePairs = urlEncodedString.split('&');
	return keyValuePairs.reduce((acc, kvPairString) => {
		const [k, v] = kvPairString.split('=');
		acc[k] = v;
		return acc;
	}, {});
}

export async function handler(event) {
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

	const {
		pocket_consumer_key: pocketConsumerKey,
		pocket_access_token: pocketAccessToken
	} = event.isBase64Encoded
		? parseUrlEncoded(Buffer.from(event.body, 'base64').toString('utf-8'))
		: JSON.parse(event.body);

	if (!pocketConsumerKey || !pocketAccessToken) {
		return {
			statusCode: 400,
			body: 'Bad Request'
		};
  }

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
}
