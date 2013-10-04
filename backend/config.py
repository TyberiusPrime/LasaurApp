

config = {
	'target_size': [380,300],
	'tolerance': 0.08,
    'ignored_colors': set(["#f6921e", '#ffffff']),
    'max_seek_speed': 8000,

    'materials': {
        # materials are encoded in color -> (speed, S-value) tuples.
        # the values may also be list of such tuples, that means we do multiple passes
        'Plywood 3mm': {
            # all these values will need to be tuned!
            '#0000ff': (10, 255), # blue -> cut
            '#ff0000': (150, 255), # heavy engraving
            '#00ff00': (150, 128), # medium engraving
            '#ff00ff': (150, 20), # light engraving
            },
        'Plywood 6mm': {
            # all these values will need to be tuned!
            '#0000ff': [(10, 255), (10,255)], # blue -> cut
            '#ff0000': (150, 255), # heavy engraving
            '#00ff00': (150, 128), # medium engraving
            '#ff00ff': (150, 20), # light engraving
            },

        }
}
