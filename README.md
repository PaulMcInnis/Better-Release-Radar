# Better-Release-Radar
This script makes it easy to see all the new album and EP releases by artists you follow on Spotify. 

No more fussing around looking through a `New Releases` playlist of only 30 songs with bad visibility, now you can look at everything in one neat table!

Example Output:
![Example](https://github.com/PaulMcInnis/Better-Release-Radar/blob/master/example.png)

###  Requirements
This project requires at least `python 3.7`

#### Authentication
You will need to [setup authentication with Spotify](https://developer.spotify.com/documentation/general/guides/authorization-guide/) such that:
- your `REDIRECT_URI` for your [spotify application](https://developer.spotify.com/my-applications) is `http://localhost:8888/callback`
- you have the set following environment variables (i.e. in your .bashrc): 
  ```
  export SPOTIPY_CLIENT_ID='your-spotify-client-id'
  export SPOTIPY_CLIENT_SECRET='your-spotify-client-secret'
  export SPOTIPY_REDIRECT_URI='http://localhost:8888/callback'
  ```
  
You can always access id & secret / rotate the secret here: [developer dashboard](https://developer.spotify.com/dashboard/).

#### Python                
Install python requirements via:
`pip3 install -r requirements.txt` or `pip install spotipy`


### Usage
```
usage: main.py [-h] [--max-age-days MAX_AGE_DAYS] [--hide-eps] [--show-urls]
               [--log-file LOG_FILE]
               [--log-level {CRITICAL,FATAL,ERROR,WARNING,INFO,DEBUG}]
               [--region REGION]

Show albums released by artists you follow on Spotify.

optional arguments:
  -h, --help            show this help message and exit
  --max-age-days MAX_AGE_DAYS
                        # of days after which results are omitted from
                        results.
  --hide-eps            don't show any EP's, only show full-length releases.
  --show-urls           Show full URLs with http:// vs Spotify URI's that you
                        must copy-paste into your search to locate. NOTE:
                        unless you have a way of opening the clicked-URLS in
                        your terminal within Spotify, it is generally easier
                        to copy-paste the URI's into Spotify Desktop
  --log-file LOG_FILE   path to logging file. Defaults to log.log
  --log-level {CRITICAL,FATAL,ERROR,WARNING,INFO,DEBUG}
                        Type of logging information shown on the terminal.
  --region REGION       Region identifier so that we show only releases in
                        your locale. Must conform to ISO 3166-1 alpha-2
                        format. Defaults to 'CA'

```
