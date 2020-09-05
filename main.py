"""Scrape a list of new albums by artists I follow on Spotify into a CLI table

TODO: this is pretty wasteful on API calls, is there a better way?
TODO: sometimes we can get duplicate albums with different URIS, filter out?
NOTE: when setting up authentication, you should set the redirect URI to match
    'http://localhost:8888/callback'
"""
import argparse
import logging
import os
import pickle
import sys
from datetime import date, datetime

import spotipy

# Inits
DEFAULT_REGION = 'CA'
MAX_AGE_DAYS_DEFAULT =  60
HEADER = '\033[95m'
BOLD = '\033[1m'
GREEN = '\033[92m'
ENDC = '\033[0m'
USERNAME_ENV_VAR_NAME = 'SPOTIPY_CLIENT_ID'
USERNAME_EXP_LENGTH = 32
REDIRECT_URI = 'http://localhost:8888/callback'
DEFAULT_LOG_FILE = os.path.join(os.path.dirname(__file__), 'log.log')
CACHE_DIR = os.path.join(os.path.dirname(__file__), '.cache')
TODAY_DATE = date.today()
TODAY_PICKLE_FILE = os.path.join(
    CACHE_DIR, f".followed_artists_{TODAY_DATE}.pkl",
)
DEFAULT_LOG_LEVEL_NAME = 'INFO'
LOG_LEVEL_REGISTRY = {
    'CRITICAL': logging.CRITICAL,
    'FATAL': logging.FATAL,
    'ERROR': logging.ERROR,
    'WARNING': logging.WARNING,
    'INFO': logging.INFO,
    'DEBUG': logging.DEBUG,
}
DEFAULT_LOG_FORMAT = "[%(asctime)s] [%(levelname)s] Organizeify: %(message)s"
SPOTIFY_ALBUM_URL_BASE = 'https://open.spotify.com/album/'


def get_logger(logger_name: str, level: int, file_path: str = DEFAULT_LOG_FILE,
               message_format: str = DEFAULT_LOG_FORMAT) -> logging.Logger:
    """Initialize and return a logger"""
    logger = logging.getLogger(logger_name)
    logger.setLevel(level)
    formatter = logging.Formatter(message_format)
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(formatter)
    logger.addHandler(stdout_handler)
    file_handler = logging.FileHandler(file_path)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    return logger


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Show albums released by artists you follow on Spotify.',
    )
    parser.add_argument(
        '--max-age-days',
        help='# of days after which results are omitted from results.',
        required=False,
        default=MAX_AGE_DAYS_DEFAULT,
        type=int,
    )
    parser.add_argument(
        '--hide-eps',
        action='store_true',
        help='don\'t show any EP\'s, only show full-length releases.',
    )
    parser.add_argument(
        '--show-urls',
        action='store_true',
        help='Show full URLs with http:// vs Spotify URI\'s that you must '
        'copy-paste into your search to locate. NOTE: unless you have a way of '
        'opening the clicked-URLS in your terminal within Spotify, it is '
        'generally easier to copy-paste the URI\'s into Spotify Desktop',
    )
    parser.add_argument(
        '--log-file',
        type=str,
        help=f'path to logging file. Defaults to {DEFAULT_LOG_FILE}',
    )
    parser.add_argument(
        '--log-level',
        type=str,
        default='INFO',
        choices=list(LOG_LEVEL_REGISTRY.keys()),
        help='Type of logging information shown on the terminal.',
    )
    parser.add_argument(
        '--region',
        type=str,
        default=DEFAULT_REGION,
        # choices=AVAILABLE_MARKETS, TODO: can do with iso3166 module
        help='Region identifier so that we show only releases in your locale. '
        'Must conform to ISO 3166-1 alpha-2 format. Defaults to '
        f'\'{DEFAULT_REGION}\'',
    )
    args = parser.parse_args(sys.argv[1:])

    # Get logger
    assert args.log_level in LOG_LEVEL_REGISTRY, "Unknown -log-level."
    logger = get_logger(
        'Better-Release-Radar', level=LOG_LEVEL_REGISTRY[args.log_level]
    )
    logger.info("Initializing...")

    # Prompt user for username
    username = os.environ['SPOTIPY_CLIENT_ID']
    if not len(username) == USERNAME_EXP_LENGTH:
        raise ValueError(
            "!!! Please export SPOTIPY_CLIENT_ID to match your Spotify username"
            ". You can find this by navigating to you user page on Spotify "
            "(click your name in top right), clicking the three dots -> "
            "share -> Copy Profile Link. It is the string after "
            "'http://open.spotify.com/user/'"
        )

    # We will retain a list of albums of these types
    allowed_groups = ['album']
    if not args.hide_eps:
        allowed_groups.append('single')

    # Authenticate + Init
    token = spotipy.util.prompt_for_user_token(
        username, 'user-follow-read', redirect_uri=REDIRECT_URI
    )
    assert token, "Spotify login unsuccessful"
    sp = spotipy.Spotify(auth=token)

    # Make folder
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)

    # Load or scrape following data
    if os.path.exists(TODAY_PICKLE_FILE):
        logger.info(f"Loaded existing scrape data from {TODAY_PICKLE_FILE}")
        artists = pickle.load(open(TODAY_PICKLE_FILE, 'rb'))
    else:
        logger.info("Scraping user following data...")

        # Get all the artists you are following
        artists = sp.current_user_followed_artists()['artists']['items']
        while True:
            logger.info(
                "Getting 20 followed artists... {}".format(artists[-1]['id'])
            )
            new_artists = sp.current_user_followed_artists(
                after=artists[-1]['id'])
            if (not new_artists or not new_artists['artists']
                    or not new_artists['artists']['items']):
                break
            artists.extend(new_artists['artists']['items'])

        # Get all the albums by every artist
        # TODO: we may want to consider aborting getting 50 more albums
        # if they are too old, but we wouldn't be saving many requests
        for art in artists:
            logger.info("Getting albums for {}...".format(art['name']))
            try:
                new_albs = sp.artist_albums(art['id'], limit=50)['items']
            except:
                art['albums'] = {}
                continue
            art['albums'] = [
                alb for alb in new_albs if alb['type'] == 'album'
            ]

        # Cache
        pickle.dump(artists, open(TODAY_PICKLE_FILE, 'wb'))

    # Apply filters
    pot_new_albums, names_seen = [], []
    for art in artists:
        for alb in art['albums']:

            # Region and ep vs album filter
            if (args.region not in alb['available_markets']
                    or alb['album_group'] not in allowed_groups):
                continue

            # Read album date
            if alb['release_date_precision'] == 'year':
                alb_date = date(int(alb['release_date']), 1, 1)

            elif alb['release_date_precision'] == 'month':
                nums = alb['release_date'].split('-')
                alb_date = date(int(nums[0]), int(nums[1]), 1)
            else:
                alb_date = datetime.fromisoformat(alb['release_date']).date()

            # Date filter
            if alb['name'] not in names_seen and abs(
                (TODAY_DATE - alb_date).days < args.max_age_days):
                alb['datetime'] = alb_date
                pot_new_albums.append(alb)
                names_seen.append(alb['name'])
            #else:
            #    # generally albums are arranged by date
            #    break

    # Sort by most recent
    pot_new_albums.sort(key=lambda r: r['datetime'], reverse=True)

    # Print out header
    logger.info("Done scrape.")
    print(
        "\nNew albums from followed artists within past {} days:\n\n"
        "{}{:<6}   {:<10}   {:<53}   {:<25}   {:<40}\n"
        "-------------------------------------------------------"
        "-------------------------------------------------------"
        "------------------------------{}".format(
            args.max_age_days,
            HEADER,
            'type',
            'date',
            'url' if args.show_urls else 'uri',
            'artist',
            'name',
            ENDC
        )
    )

    # Print out rows
    for alb in pot_new_albums:
        if args.show_urls:
            # make the full (clickable) URL form the (searchable) URI
            alb['url'] = SPOTIFY_ALBUM_URL_BASE + alb['uri'].split(':')[2]

        if len(alb['name']) > 40:
            # Truncate long names
            alb['name'] = alb['name'][:37] + '...'

        print("{}{:<6}   {:<10}   {:<53}   {:<25}   {:<40}{}".format(
            '' if alb['album_group'] == 'single' else BOLD + GREEN,
            alb['album_group'],
            alb['release_date'],
            alb['url'] if args.show_urls else alb['uri'],
            alb['artists'][0]['name'],
            alb['name'],
            '' if alb['album_group'] == 'single' else ENDC,
        ))
