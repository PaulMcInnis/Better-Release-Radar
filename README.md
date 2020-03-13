# Better-Release-Radar
This is a script which uses Spotipy API calls to show you new albums by all the artists you follow on Spotify, by date.

What is the point of following artists on Spotify if it doesn't tell you when they release a new album every time? Why is there no way to see all the most recent albums in one place?

This is an improvement on Spotify's own Release Radar which is a truncated playlist and which makes it easy to miss new releases by artists you follow.

Example Output:
![Example](https://github.com/PaulMcInnis/Better-Release-Radar/blob/master/example.png)

###  Requirements
This project requires at least `python 3.7`

You will need to setup authentication with Spotify, see details here and update `main.py` with your username and selected redirect uri: https://developer.spotify.com/documentation/general/guides/authorization-guide/

Install python requirements via:
`pip3 install -r requirements.txt` or `pip install spotipy`


### Usage
```
usage: main.py [-h] [--num-days NUM_DAYS] [--hide-eps]

Show releases by artists you follow on Spotify

optional arguments:
  -h, --help           show this help message and exit
  --num-days NUM_DAYS  # of days after which results are omitted
  --hide-eps           don't show any EPs
```
