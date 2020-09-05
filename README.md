# Better-Release-Radar
This is a script which uses Spotipy API calls to show you new albums by all the artists you follow on Spotify, by date.

What is the point of following artists on Spotify if it doesn't tell you when they release a new album every time? Why is there no way to see all the most recent albums in one place?

This is an improvement on Spotify's own Release Radar which is a truncated playlist and which makes it easy to miss new releases by artists you follow.

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
  export SPOTIPY_REDIRECT_URI='your-app-redirect-url'
  ```

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
