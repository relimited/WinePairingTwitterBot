var Bot = require('./twit/bot') //twitter bot functionality
  , config1 = require('./twit/config1'); //config file for twitter
var http = require('http'); //http requests with node
var grapeList = require('./grapes'); //manually compiled a list of grapes because I'm a scrub
var cheerio = require('./cheerio/lib/cheerio'); //html parsing (transform that html in a dom.  Motherfuckers love dom).
var objectList = require('./objects'); //corporaJS list of objects

var bot = new Bot(config1); //twitter bot functionality
console.log('Academic Wine Paring Bot: Running.');

//'global' vars
var paperTitlesRetrieved = false;
var paperTitles = [];
var shortURLSize = 24;

//return this year
function getCurrentYear () {
  var d = new Date();
  return d.getFullYear();
};

//return a potential wine year
//0-6 years seems to be pretty safe for wine aging.  Plus, Twitter bots are best when they sometimes output madness
function getWineYear () {
	return getCurrentYear() - Math.floor(Math.random() * 6) + 1;
}

function handleError(err) {
  console.error('response status:', err.statusCode);
  console.error('data:', err.data);
};

function getGrape(){
	var randIndex = Math.floor(Math.random() * grapeList.list.length);
	return grapeList.list[randIndex];
}

//get a random word from the word corpora
function getRandObject(){
	var randIndex = Math.floor(Math.random() * objectList.list.length);
	return objectList.list[randIndex];
}

//functions to search google scholar using a pair of keywords
//NOTE: this will break hard if google ever changes the layout of scholar returns.  But, a google scholar API doesn't exsist and 
//I don't feel like using Python for the popular crowdsourced variant, so http requests for me!
function searchGoogleScholar(term1, term2){
	var httpOptions = {
		hostname : "scholar.google.com",
		port : 80,
		method : 'GET',
		path : "/scholar?hl=en&q="+encodeURI(term1)+"+"+encodeURI(term2)
	};
	
	var req = http.get(httpOptions, function(result){
		//console.log('headers:\n' + JSON.stringify(result.headers));
  		result.setEncoding('utf8');
  		var html = "";
  		result.on('data', function (chunk) {
    		html = html + chunk;
  		});
  		result.on('end', function(){
  			$ = cheerio.load(html);
  			var titles = $('h3[class=gs_rt]');
  			//just deal with the first page of titles for now
  			for(var i = 0; i < 9; i++){
  				var title = titles[i];
  				//now, unpack any and all title data
  				//console.log(title);
  				var titleText = title.children[0];
  				var finalText = "";
  				for(var j = 0; j < titleText.children.length; j++){
  					finalText = finalText + titleText.children[j].data;
  				}
  				//cull out any titles that contain undefined in them
  				if(finalText.indexOf("undefined") > -1){
  					continue;
  				}else{
  					//get the link
  					var link = titleText.attribs.href;
  					paperTitles.push({"text": finalText, "link": link});
  				}
  			}
  			
  			if(paperTitles.length == 0){
  				console.log("The words " + term1 + " and " + term2 + " did not result in any relevant papers");
  			}else{
  				//now that we have paper titles, finish creating the tweet
  				createTweet(paperTitles);
  				paperTitlesRetrieved = true;
  			}
  		});
	});
	req.on('error', function(e){
		console.log('problem with request: ' + e.message);
	});
	req.end();
	
}

//now that we have some paper titles to use, lets create the remainder of the tweet
function createTweet(paperTitles){
	//because the whole thing is way better the more complicated the paper title, sort complex paper titles first
	paperTitles.sort(function(a, b){
		if(a.text.length > b.text.length){
			return -1;
		}else if(a.text.length < b.text.length){
			return 1;
		}else{
			return 0;
		}
	});
	
	var createdTweet = false;
	var numberOfAttempts = 0;
	while(!createdTweet || numberOfAttempts < 10){
		//get a year
		var year = getWineYear() + "";
	
		//now, get a grape
		var grape = getGrape() + "";
	
		console.log(paperTitles, year, grape);
		
		var tweet = "";
		for(var i = 0; i < paperTitles.length; i++){
			tweet = "A " + year + " " + grape + " pairs well with \"" + paperTitles[i].text + "\"";
			if(tweet.length <= 140 - shortURLSize){
				//append the link
				tweet = tweet + " " + paperTitles[i].link;
				createdTweet = true;
				break;
			}
		}
		
		//shouldn't be needed, but is for some reason
		if(createdTweet == true){
			break;
		}
		
		numberOfAttempts = numberOfAttempts + 1;
		
		//also this shouldn't be needed, but is
		if(numberOfAttempts > 10){
			break;
		}
	}
	
	//console.log("tweet:\n" + tweet);
	//and do the actual tweeting
	bot.tweet(tweet, function (err, reply) {
        if(err){ 
        	return handleError(err); 
        }
        
    	console.log('\nTweet: ' + (reply ? reply.text : reply));
	});
}

//Get the random seeds to build the initial tweet
function initTweetBuild(){
	//the first thing to do is to get some random words
	var word1 = getRandObject();
	var word2 = getRandObject();
	
	//use those for a google scholar search
	searchGoogleScholar(word1, word2);
	
	//THE REST OF THE WORK IS DONE IN THE searchGoogleScholar Function because async HTTP requests, yo.
}

//Every hour, attempt to tweet a wine paring
setInterval(function() {
	var date = new Date();
	if(date.getHours() % 20 == 0){
		//get the current t.co max length
		bot.getConfiguration(function(err, data, response){
			//console.log("short_url_length_https:\n" + data.short_url_length_https);
			if(err){
				return handleError(err);
			}else{
				if(shortURLSize !== (data.short_url_length_https + 1)){
					shortURLSize = data.short_url_length_https;
					initTweetBuild();
				}
			}
		});
	}else{
		initTweetBuild();
	}
}, 3600000);
