from collections import OrderedDict

config = {
	'target_size': [380,300],
	'tolerance': 0.08,
    'ignored_colors': set(["#f6921e", '#ffffff']),
    'max_seek_speed': 8000,

    'materials': {
        # materials are encoded in color -> (speed, S-value) tuples.
        # the values may also be list of such tuples, that means we do multiple passes
        'Plywood 3mm': OrderedDict([
            # all these values will need to be tuned!
            ('#ff0000', (150, 100)), # heavy engraving
            ('#00ff00', (150, 50)), # medium engraving
            ('#ff00ff', (150, 10)), # light engraving
            ('#0000ff', (10, 100)), # blue -> cut
            ('', (100, 10)), # default value
            ]),
        'Plywood 6mm': OrderedDict([
            # all these values will need to be tuned!
            ('#ff0000', (150, 100)), # heavy engraving
            ('#00ff00', (150, 50)), # medium engraving
            ('#ff00ff', (150, 10)), # light engraving
            ('#0000ff', [(10, 100), (15,100)]), # blue -> cut
            ]),

        }
}
